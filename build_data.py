"""Validate the public CSVs and generate a classic script usable on GitHub Pages and file://."""

import argparse
import csv
import json
import os
import re
import sys
import tempfile
from calendar import monthrange
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.parse import urlsplit


DATA = Path(__file__).resolve().parent / "data"
OUTPUT = DATA / "site-data.js"


def read_csv(name):
    with (DATA / name).open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        rows = list(reader)
        if not reader.fieldnames or len(set(reader.fieldnames)) != len(reader.fieldnames):
            raise ValueError(f"{name} 表头缺失或包含重名列")
        if any(None in r or None in r.values() for r in rows):
            raise ValueError(f"{name} 存在列数不一致的行")
        return reader.fieldnames, rows


def month(text):
    if not re.fullmatch(r"[0-9]{4}-[0-9]{2}", text):
        raise ValueError(f"月份格式应为 YYYY-MM，实际为 {text!r}")
    date.fromisoformat(text + "-01")
    return text


def number(text, bound=False):
    if text == "":
        return None
    value = Decimal(text)
    if not value.is_finite() or (bound and not -9 <= value <= 9):
        raise ValueError(f"分值无效 {text!r}")
    return float(value)


def url(text):
    if text:
        parsed = urlsplit(text)
        if parsed.scheme not in {"https", "http"} or not parsed.hostname:
            raise ValueError(f"来源应为公开网页地址，实际为 {text!r}")
    return text


def history_rows():
    columns, rows = read_csv("history.csv")
    names = [c for c in columns if c != "月份"]
    countries = ["俄罗斯" if c == "俄罗斯（苏联）" else c for c in names]
    if len(set(countries)) != len(countries) or not rows:
        raise ValueError("历史月表为空或有重复国家")
    history = [{"month": month(r["月份"]), "values": [number(r[k], True) for k in names]} for r in rows]
    history.sort(key=lambda r: r["month"])
    if len({r["month"] for r in history}) != len(history):
        raise ValueError("历史月表有重复月份")
    return countries, history


def build():
    release = json.loads((DATA / "release.json").read_text(encoding="utf-8-sig"))
    cutoff = date.fromisoformat(release["asOf"])
    checked_at = release.get("checkedAt", "")
    if checked_at:
        stamp = datetime.fromisoformat(checked_at)
        if stamp.utcoffset() is None or stamp.date() != cutoff:
            raise ValueError("checkedAt 应含时区且与 asOf 同日")
    as_of = cutoff.isoformat()
    countries, history = history_rows()
    _, ledger = read_csv("events.csv")
    events = []
    seen = set()
    by_month = defaultdict(list)
    for r in ledger:
        country, event_id, day = r["国家"], r["事件编号"], r["发生日"]
        key = (country, event_id)
        if country not in countries or not event_id or key in seen or date.fromisoformat(day) > cutoff:
            raise ValueError(f"请检查事件的国家、编号或日期 {country} {event_id} {day}")
        seen.add(key)
        if not r["原文一"] or not r["可查行动"]:
            raise ValueError(f"{event_id} 缺少事件或主要来源")
        events.append(dict(country=country, id=event_id, date=day, action=r["可查行动"],
                           score=number(r["主编码"], True), alternative=number(r["另一合理编码"], True),
                           rule=r["适用规则"], note=r["归并和判断"], alternativeReason=r["备选理由（另见备注）"],
                           url=url(r["原文一"]), url2=url(r["原文二"])))
        by_month[country, day[:7]].append(r)

    _, summary = read_csv("monthly.csv")
    numeric_fields = {"estimate": "本项目独立估计", "start": "上月末起点", "delta": "关系分变动",
                      "positive": "已编码正分小计", "negative": "已编码负分小计", "official": "清华原组明文",
                      "graph": "清华原图约值", "low": "备选低值", "high": "备选高值"}
    monthly = []
    keys = set()
    for r in summary:
        country, period = r["国家"], month(r["月份"])
        key = (country, period)
        if country not in countries or key in keys or period > as_of[:7]:
            raise ValueError(f"月表国家、月份或重复键有误 {key}")
        keys.add(key)
        if period == as_of[:7]:
            day_label = re.search(r"截至\s*(\d{1,2})\s*日", r["结果性质"])
            if day_label and int(day_label[1]) != cutoff.day:
                raise ValueError(f"{key} 的暂估截止日与 release.json 不符")
            if "月末估计" in r["结果性质"] and cutoff.day != monthrange(cutoff.year, cutoff.month)[1]:
                raise ValueError(f"{key} 为月末估计，截止日仍在月中")
        group = by_month[key]
        count, pending = int(r["候选数"]), int(r["主分待定数"])
        if count != len(group) or pending != sum(not x["主编码"] for x in group):
            raise ValueError(f"{key} 的候选数或主分待定数与事件账不符")
        scores = [Decimal(x["主编码"]) for x in group if x["主编码"]]
        if (sum(x for x in scores if x > 0), sum(x for x in scores if x < 0)) != (
            Decimal(r["已编码正分小计"]), Decimal(r["已编码负分小计"])
        ):
            raise ValueError(f"{key} 的正负小计与事件账不符")
        values = {k: number(r[col], k in {"estimate", "start", "official", "graph", "low", "high"})
                  for k, col in numeric_fields.items()}
        monthly.append(dict(country=country, month=period, **values, status=r["结果性质"], scope=r["核查范围"],
                            urls=[url(u.strip()) for u in r["来源"].split("|") if u.strip()],
                            uncertain=pending, count=count))
    if by_month.keys() - keys:
        raise ValueError(f"以下事件尚无对应月份的月表 {sorted(by_month.keys()-keys)}")
    if not monthly or max(r["month"] for r in monthly) != as_of[:7]:
        raise ValueError("release.json 截止月与月表最后一月不一致")
    if history[-1]["month"] > as_of[:7]:
        raise ValueError("历史月表含网站数据截止日以后的月份")
    observed_months = {r["month"] for r in monthly}
    if len(keys) != len(observed_months) * len(countries):
        raise ValueError("项目月表有国家缺行。整月资料缺口可保留国别行并留空估值。")
    return dict(asOf=as_of, checkedAt=checked_at, officialEnd=history[-1]["month"], countries=countries, history=history,
                monthly=monthly, events=events)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="核对数据和已生成文件；保持文件原样")
    args = parser.parse_args()
    data = build()
    payload = ("window.RELATIONS=" + json.dumps(data, ensure_ascii=False, separators=(",", ":"),
                                                allow_nan=False) + ";\n").encode("utf-8")
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_bytes() != payload:
            raise ValueError("data/site-data.js 与 CSV 不一致，请先运行 python build_data.py")
    else:
        with tempfile.NamedTemporaryFile(dir=DATA, delete=False) as temp:
            temp.write(payload)
            pending = Path(temp.name)
        try:
            os.replace(pending, OUTPUT)
        finally:
            pending.unlink(missing_ok=True)
    print(f"{data['asOf']}  |  历史 {len(data['history'])} 月  |  项目 {len(data['monthly'])} 国别月"
          f"  |  事件 {len(data['events'])} 条")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, InvalidOperation, OSError) as error:
        sys.exit(f"网页数据校验失败：{error}")
