# 自定义设备模型

把设备 mockup 图片放到本目录，然后编辑 `devices.json` 即可新增设备，不需要改代码。

## 目录结构

```
public/frames/
  devices.json
  iphone-16-pro.png
  macbook-air.png
  ...
```

## devices.json 格式

```json
{
  "devices": [
    {
      "id": "iphone-16-pro",
      "name": "iPhone 16 Pro",
      "note": "自定义素材",
      "image": "/frames/iphone-16-pro.png",
      "screen": { "x": 120, "y": 140, "w": 960, "h": 2088, "radius": 110 },
      "mode": "under",
      "shadow": false
    }
  ]
}
```

字段说明：

- `id`：唯一标识，不能和内置设备重复（例如不要用 `iphone15`）。
- `name` / `note`：设备卡片上显示的名称与说明。
- `image`：图片路径，以 `/frames/` 开头（相对于 `public` 目录）。
- `screen`：截图显示区域，**单位是原图像素**：
  - `x` / `y`：屏幕区域左上角相对图片左上角的坐标
  - `w` / `h`：屏幕区域的宽高
  - `radius`：屏幕圆角半径（像素，可选）
- `mode`：
  - `"under"`（默认）：先画截图，再把设备框盖在上面。适合**屏幕区域透明**的 mockup。
  - `"over"`：先画设备框，再把截图盖在屏幕区域上。适合屏幕是黑色/不透明的素材。
- `shadow`：是否额外叠加一层程序生成的设备阴影。素材自带阴影时保持 `false`。

设备在画布中的宽高比会自动取图片的原始比例，不需要配置。

## 替换系统内置模型

内置设备 id：

`iphone15`、`iphone14`、`iphoneSE`、`ipad`、`macbookAir`、`macbookPro`、`imac`、`none`

在 `devices.json` 里使用**相同的 id**，就会用你的图片替换对应内置模型（卡片位置保持不变）：

```json
{
  "devices": [
    {
      "id": "iphone15",
      "image": "/frames/my-iphone15.png",
      "screen": { "x": 90, "y": 110, "w": 820, "h": 1920, "radius": 100 },
      "mode": "under"
    }
  ]
}
```

这时 `name` / `note` 可以不写，会沿用内置模型的名称和说明。想改名称就写上：

```json
{ "id": "iphone15", "name": "iPhone 15 Pro 黑色", "note": "我的素材", ... }
```

如果只想改内置模型的名称、说明或宽高比，而不换成图片：
编辑 `src/data.ts` 里的 `DEVICES` 数组。

如果你想微调手绘的矢量模型（iPhone / iPad / MacBook / iMac）：
编辑 `src/lib/draw.ts` 里的 `drawDevice`、`drawMacbook`、`drawImac`。

## 如何确定 screen 数值

不用手动量像素：在应用左侧「设备模型」里点「自定义设备」，上传这张图后拖动框选屏幕区域，
右侧的 X / Y / 宽 / 高 / 圆角 会实时显示，点「复制配置」即可得到可直接粘贴的 JSON。

## 更新后

保存 `devices.json` 后刷新页面，新设备会出现在「设备模型」列表中。
`mode` 选错时，截图会被设备框盖住或盖住设备边框，切换成另一个值即可。
