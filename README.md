# 中国双边关系观察

项目仓库：[qyhj617/jingwei-observer](https://github.com/qyhj617/jingwei-observer)。展示地址：[经纬观察](https://qyhj617.github.io/jingwei-observer/)。本版核查截至 **2026-11-18 09:10（北京时间）**，不是18日全天数据。

本轮接续凌晨版本，补录23条、订正7条，全期事件账945条；其中3条原待核经原文确认改为零分，新增2条待核。本月中澳独立估计由−1.3修正为−1.4，其余十一国主值未变，中韩仍为3.7。中澳变化来自补入2025年12月临时反倾销措施和2026年6月终裁后逐月重算，不是今天新发生的冲突。美方关税排除延期和中韩商务部长会议也已补录，尚未改变各自0.1刻度的本月分数。

清华官方整表仍截至2025-08；本次已查发布渠道未取得新增明确原组月值。完整检索范围、原文及编码分歧见月表和事件账；待核主编码保持空白，另保留备选情景。更早公开版本可在GitHub提交历史对照。

研究更新计划为北京时间每天 09:00。核查完成后提交新版文件，由 GitHub Pages 部署；实际截止时刻以页面底部及 `data/release.json` 为准。

这里保存中国与十二国的双边关系月度数据、项目估计及事件原文。读者可以打开 `index.html` 浏览本站。网页通过相对路径加载同目录的资源，下载整个目录后也可以离线查看图表和事件，打开外部原文需要联网。

## 首次发布到 GitHub Pages

1. 在准备发布的 GitHub 仓库中，把**本目录内的全部文件**放在同一分支的根目录。应能直接在仓库首页看到 `index.html`、`.nojekyll` 和 `data/`。已经生成的网页可以直接发布。
2. 在仓库的 **Settings → Pages → Build and deployment** 中，选择 **Deploy from a branch**。在分支列表中选择刚上传文件的分支（例如 `main`），目录选 **/(root)**，点击 **Save**。
3. 部署完成后，在同一设置页打开站点地址。以后向所选分支提交新版文件，GitHub Pages 会重新发布。仓库的 **Actions** 页可查看部署结果。[GitHub 官方发布说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## 每期更新

1. 在研究工作簿或原有核算流程里补录事件、重算月分并复核。将这期**累计到新截止日的完整表**按以下文件名存入 `data/`，保留现有列名，使用 UTF-8 CSV。若只改了 Excel，需要先将月度结果和事件账同步到两个 CSV。

   | 文件 | 内容及更新时机 |
   | --- | --- |
   | [monthly.csv](data/monthly.csv) | 已核的十二国逐月项目分及其起点、备选值、原组对照和检索范围。月内周更覆盖相应月份的暂估；新增月份时为十二国分别增加行。 |
   | [events.csv](data/events.csv) | 全期事件，每条保留稳定的国别事件编号、实际发生日、行动、主编码、依据与原文地址。待定主编码留空，已确认零分填 `0`。 |
   | [history.csv](data/history.csv) | 清华公布的十二国完整历史月表。取得并核对新版正式整表时才更新。论文中新增的单国明文或读图数值，分别写入月表的“清华原组明文”和“清华原图约值”，保留同月项目估计。 |

2. 打开 [release.json](data/release.json)，把 `asOf` 改为本期**已核数据截止日**，格式为 `YYYY-MM-DD`；`checkedAt` 写含时区的实际时刻，例如 `2026-11-19T09:00:00+08:00`。若 11 月 19 日更新，月表十一月各行的“结果性质”相应写作“项目月内暂估（截至19日）”，检索范围写明本次实际覆盖的日期与来源。月底完成全月核查后改用“项目月末估计”。
3. 在网页仓库根目录用 Python 3.8 或更新版本执行以下命令。第一条把已核 CSV 转成网页可直接读取的 `data/site-data.js`，第二条核对这个文件与三份表的内容。无需安装额外 Python 包。

   ```sh
   python build_data.py
   python build_data.py --check
   ```

4. 浏览器打开 `index.html`，检查新截止日和一个有变化的国家月份。在同一份提交中包含已更新的 CSV、`data/release.json` 和 `data/site-data.js`。可在 GitHub 的提交历史回看某一期发布时的估计。

构建程序会核对国家、月份、事件编号、截止日、国别月事件数、待定数和已编码正负小计，并保留表中每个月已核算的分值。发现错误时会给出对应的位置；写入成功后显示本期的历史月数、项目国别月数和事件数。

## 数据出处

首页地图使用 Natural Earth 的 1:110m 公共领域陆地数据绘制，经纬网与城市连线用于地理定位。[Natural Earth 数据说明](https://www.naturalearthdata.com/about/terms-of-use/)

历史月表来自清华大学国际关系研究院的十二国分值表。之后各月由本项目按公开方法独立估计；原组后来发布的明文和读图观测与项目估计可以同时出现在同一国别月。项目月表的“来源”和事件账的“原文一、原文二”保留相应链接。[清华数据目录](https://www.tuiir.tsinghua.edu.cn/kycg/zwgxsj.htm) · [本版所用清华历史整表发布页](https://www.tuiir.tsinghua.edu.cn/info/1145/6264.htm) · [清华评分手册](https://www.tuiir.tsinghua.edu.cn/info/1145/2618.htm)
