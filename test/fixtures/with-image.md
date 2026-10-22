# 本地图片与安全渲染验证

![传输过程](images/diagram.svg)

<script>window.__mdrXssExecuted = true</script>

<img src="x" onerror="window.__mdrXssExecuted = true">

[危险链接](javascript:window.__mdrXssExecuted=true)

正文应保留。图片从本地文件读取，脚本和事件属性不能执行。
