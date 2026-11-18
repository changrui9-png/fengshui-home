import type { SourceRef } from "./types";

export const SOURCES = {
  zhaijing: {
    title: "《宅经》卷上",
    url: "https://ctext.org/wiki.pl?chapter=182804",
    edition: "中国哲学书电子化计划收录本。传世本题黄帝，作者实不可考；《四库全书总目》列入术数类。",
    quotePolicy: "只标出可在该章核对的短句「以门户为冠带」和「宅门大内小」，不编页码，不把整段古籍贴进报告。",
  } satisfies SourceRef,
  yangzhai: {
    title: "《阳宅十书》书目",
    url: "https://ctext.org/wiki.pl?if=gb&res=618102",
    edition: "王君荣纂辑。中国哲学书电子化计划该本由影印 OCR 而成，错字很多。",
    quotePolicy: "只作书目链接。不引用 OCR 正文，避免把错字当成原文。",
  } satisfies SourceRef,
  wikipediaFengshui: {
    title: "维基百科「风水」",
    url: "https://zh.wikipedia.org/zh-hans/%E9%A3%8E%E6%B0%B4",
    edition: "综述页，区分形势（峦头）与方位（理气），并说明八宅、玄空是后世流派。",
    quotePolicy: "用作流派史的二手说明，不把它当成古书原文。",
  } satisfies SourceRef,
  wikipediaStars: {
    title: "维基百科「九宫飞星图」",
    url: "https://zh.wikipedia.org/zh-hans/%E4%B9%9D%E5%AE%AE%E9%A3%9B%E6%98%9F%E5%9C%96",
    edition: "三元九运年份表，例如八运 2004–2023、九运 2024–2043。",
    quotePolicy: "只借用年份与运的对应，用来说明缺什么数据。不起山星、向星盘。",
  } satisfies SourceRef,
  elevatorPopular: {
    title: "当代通俗说法，无古典电梯专条",
    url: "https://ctext.org/wiki.pl?chapter=182804",
    edition: "《宅经》讨论门户与五虚，成书远早于现代电梯，没有电梯条文。",
    quotePolicy: "电梯与户门的所谓「门冲」只标为当代通俗说法，不伪托古籍，不写页码。",
  } satisfies SourceRef,
  popularForm: {
    title: "当代通俗峦头惯例",
    url: "https://zh.wikipedia.org/zh-hans/%E9%A3%8E%E6%B0%B4",
    edition: "床、镜、厕门、灶的相对位置，未能在所引《宅经》卷上核对到专条。",
    quotePolicy: "几何关系按图计算。文化句子标明通俗和低信心，不写成古典引文。",
  } satisfies SourceRef,
  practical: {
    title: "居住环境观察",
    url: "https://zh.wikipedia.org/zh-hans/%E9%A3%8E%E6%B0%B4",
    edition: "本项目自己的实用分类，不是风水文献。",
    quotePolicy: "只描述采光记录、动线、通风、噪声、振动和隐私。不引用建筑规范条文号，也不把风水说成这些现象的原因。",
  } satisfies SourceRef,
  videoTo3d: {
    title: "video-to-3d scene.json",
    url: "https://github.com/Srijjit-V/video-to-3d",
    edition: "MIT License。本项目不复制其 COLMAP / 深度模型代码，只读取它写出的 scene.json。",
    quotePolicy: "测量范围和警告原样保留。该文件没有罗盘，因此不能提供房间朝向。",
  } satisfies SourceRef,
};
