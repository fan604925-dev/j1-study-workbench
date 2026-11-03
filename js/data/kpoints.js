/**
 * 初一学习工作台 - 知识点图谱（默认数据，可在设置页编辑）
 * ============================================================
 * 图谱是数据不是硬编码：所有下拉/级联/处方/计划生成均从此文件读取。
 * 自定义知识点运行时写入 j1_kpointOverrides（custom:true）；
 * 停用内置知识点写入 j1_deletedKpointIds（防版本升级复活）。
 * 教材：数学·人教版七上 / 语文·部编版七上 / 英语·人教版七上
 * ============================================================
 */
(function (global) {
  'use strict';

  // 紧凑构造器
  function kp(id, subject, chapter, name, micro, practice, criteria, minutes, causes, extra) {
    return Object.assign({
      id: id, subject: subject, term: '七上', chapter: chapter, name: name,
      keywords: [], prerequisites: [],
      prescription: {
        microLesson: micro,
        practiceTypes: practice,
        masteryCriteria: criteria,
        estMinutes: minutes,
        reviewRhythm: [1, 3, 7],
        commonCauses: causes
      },
      custom: false, enabled: true
    }, extra || {});
  }

  const kpoints = [
    /* ================= 数学 · 人教版七年级上册 ================= */
    // 第一章 有理数
    kp('math.rational.signed_number', 'math', '第一章 有理数', '正负数与数轴',
      '用温度/海拔例子理解正负；画数轴标出给出的数', ['判断正负 10 题', '数轴标点 8 题'],
      '能口述"0 的意义"，数轴标点 8 题对 7', 15, ['concept', 'reading']),
    kp('math.rational.opposite_abs', 'math', '第一章 有理数', '相反数与绝对值',
      '背"互为相反数的两数之和为 0"；|a| 的三种情况', ['求相反数与绝对值 10 题', '化简 |-a| 类 6 题'],
      '10 题对 9 且能说出 |-5| 为什么等于 5', 15, ['concept', 'sloppy']),
    kp('math.rational.compare', 'math', '第一章 有理数', '有理数大小比较',
      '口诀"数轴上右边的数大"；负数比较先看绝对值', ['比较大小 12 题', '按从小到大排列 4 组'],
      '含负数比较 12 题对 10', 15, ['concept', 'calc']),
    kp('math.rational.add_sub', 'math', '第一章 有理数', '有理数加减法',
      '先定符号再算绝对值；减法转加法 a-b=a+(-b)', ['加减混合 10 题', '口算 20 题'],
      '20 题口算对 17，符号错误不超过 3 个', 15, ['calc', 'concept']),
    kp('math.rational.mul_div', 'math', '第一章 有理数', '有理数乘除法',
      '同号得正异号得负；除法转乘法（乘倒数）', ['乘除 12 题', '混合符号判断 10 题'],
      '12 题对 10 且能说清符号规则', 15, ['calc', 'sloppy']),
    kp('math.rational.power', 'math', '第一章 有理数', '乘方',
      '区分 -2² 与 (-2)²；任何数的 0 次幂是 1', ['乘方计算 10 题', '易混对比 6 题'],
      '-2² 与 (-2)² 类对比题 6 题全对', 15, ['concept', 'calc']),
    kp('math.rational.scientific', 'math', '第一章 有理数', '科学记数法与近似数',
      'a×10ⁿ 中 1≤|a|<10；看精确到哪一位', ['科学记数法 8 题', '近似数判断 6 题'],
      '8 题对 7', 12, ['concept', 'sloppy']),
    kp('math.rational.mixed_ops', 'math', '第一章 有理数', '有理数混合运算',
      '背"先乘方→再乘除→后加减，有括号先算括号"，看 1 道例题', ['口算 10 题', '混合运算 6 题', '应用 2 题'],
      '连续 2 次 10 题对 9，且能口述运算顺序', 15, ['concept', 'calc', 'sloppy']),
    // 第二章 整式的加减
    kp('math.algebra.monomial_poly', 'math', '第二章 整式的加减', '单项式与多项式',
      '单项式系数与次数；多项式是单项式的和', ['判断系数次数 12 题'],
      '12 题对 10', 12, ['concept']),
    kp('math.algebra.like_terms', 'math', '第二章 整式的加减', '同类项与合并',
      '同类项=字母相同且指数相同；合并只合并系数', ['合并同类项 10 题', '找同类项 6 题'],
      '10 题对 9', 15, ['concept', 'calc']),
    kp('math.algebra.remove_brackets', 'math', '第二章 整式的加减', '去括号法则',
      '括号前是负号，去括号后各项都变号', ['去括号 8 题', '化简求值 4 题'],
      '10 题对 9 且能说出变号规则', 15, ['concept', 'sloppy']),
    kp('math.algebra.simplify_eval', 'math', '第二章 整式的加减', '化简求值',
      '先化简再代入；代入负数要加括号', ['化简求值 8 题'],
      '8 题对 7，负数代入不出错', 15, ['calc', 'sloppy']),
    // 第三章 一元一次方程
    kp('math.equation.equality', 'math', '第三章 一元一次方程', '方程与等式性质',
      '等式两边同加减乘除（除数不为 0）', ['等式变形判断 10 题'],
      '10 题对 9', 12, ['concept']),
    kp('math.equation.solve', 'math', '第三章 一元一次方程', '一元一次方程解法',
      '五步：去分母→去括号→移项→合并→系数化 1', ['基础解方程 8 题', '含分母 6 题', '含括号 6 题'],
      '连续 2 次 10 题对 9', 20, ['calc', 'method', 'sloppy']),
    kp('math.equation.word_problem', 'math', '第三章 一元一次方程', '实际问题（行程/工程/销售）',
      '行程：路程=速度×时间；先画线段图再设未知数', ['行程问题 4 题', '工程问题 3 题', '销售问题 3 题'],
      '能独立设未知数并列出方程，10 题对 7', 20, ['method', 'reading']),
    kp('math.equation.modeling', 'math', '第三章 一元一次方程', '建模与检验',
      '解完必检验：代回原方程看两边是否相等', ['解方程并检验 6 题'],
      '6 题全部带检验且正确', 15, ['method', 'sloppy']),
    // 第四章 几何图形初步
    kp('math.geometry.solid_net', 'math', '第四章 几何图形初步', '立体图形与展开图',
      '正方体 11 种展开图；对面不相邻', ['展开图判断 8 题', '找对面 6 题'],
      '8 题对 7', 12, ['concept']),
    kp('math.geometry.point_line', 'math', '第四章 几何图形初步', '点线面体',
      '点动成线、线动成面、面动成体', ['概念判断 10 题'],
      '10 题对 9', 10, ['concept']),
    kp('math.geometry.segment_midpoint', 'math', '第四章 几何图形初步', '线段与中点',
      '两点之间线段最短；中点分等长两段', ['线段计算 8 题', '中点计算 6 题'],
      '8 题对 7', 15, ['calc', 'concept']),
    kp('math.geometry.angle_bisector', 'math', '第四章 几何图形初步', '角与角平分线',
      '1°=60′；角平分线分等角', ['角度换算 8 题', '角平分线计算 6 题'],
      '8 题对 7', 15, ['calc', 'concept']),
    kp('math.geometry.complement_supplement', 'math', '第四章 几何图形初步', '余角补角与方位角',
      '余角和 90°、补角和 180°；同角余角相等', ['求余补角 10 题', '方位角 4 题'],
      '10 题对 9', 15, ['concept', 'calc']),

    /* ================= 语文 · 部编版七年级上册 ================= */
    // 基础
    kp('chinese.basic.ziyin_zixing', 'chinese', '基础知识', '字音字形',
      '每天过一遍课下注释里的易读错字、易写错字', ['注音 10 字', '改错字 10 字'],
      '本册易错字听写 20 个对 17', 15, ['sloppy']),
    kp('chinese.basic.ciyu', 'chinese', '基础知识', '词语与成语运用',
      '按课归类积累成语，记语境例句', ['成语运用选择 10 题'],
      '10 题对 8', 15, ['reading', 'concept']),
    kp('chinese.basic.bingju', 'chinese', '基础知识', '病句修改',
      '背常见病句类型：搭配不当/成分残缺/语序不当/重复', ['辨析病句 10 题', '修改 5 题'],
      '10 题辨析对 8', 15, ['concept', 'reading']),
    kp('chinese.basic.biaodian', 'chinese', '基础知识', '标点符号',
      '重点：引号与句号位置、问号使用、顿号逗号区分', ['标点选择 10 题'],
      '10 题对 8', 12, ['sloppy', 'concept']),
    // 文言文
    kp('chinese.classic.shishuoxinyu', 'chinese', '文言文', '《世说新语》二则',
      '咏雪/陈太丘与友期行：逐句译文+重点实词', ['默写 6 句', '翻译 4 句', '实词解释 10 个'],
      '能默写名句并翻译全文，实词对 8/10', 20, ['concept', 'reading']),
    kp('chinese.classic.lunyu12', 'chinese', '文言文', '《论语》十二章',
      '逐句译文+4 个实词（时/习/愠/省）+成语归纳', ['默写 6 句', '翻译 3 句', '理解填空 3 题'],
      '能默写 6 句并说出 3 个虚词用法', 20, ['concept', 'reading']),
    kp('chinese.classic.gushi', 'chinese', '文言文', '课外古诗词诵读',
      '《观沧海》《闻王昌龄左迁龙标》等：背默+情感主旨', ['默写 8 句', '理解性默写 4 题'],
      '8 句默写全对', 15, ['sloppy', 'reading']),
    kp('chinese.classic.xuci', 'chinese', '文言文', '文言实词与虚词',
      '积累"之/其/而/以"常见用法，各记 2 个例句', ['虚词选择 10 题', '实词解释 10 个'],
      '虚词 10 题对 8', 15, ['concept']),
    kp('chinese.classic.fanyi', 'chinese', '文言文', '句子翻译与断句',
      '翻译口诀：留删换调补；断句看语气词和动词', ['翻译 5 句', '断句 3 段'],
      '5 句翻译踩点全对', 15, ['method', 'reading']),
    // 现代文阅读
    kp('chinese.reading.jishuwen', 'chinese', '现代文阅读', '记叙文要素与内容概括',
      '六要素梳理法：时地人事+起因经过结果', ['概括段意 5 题', '概括全文 3 篇'],
      '能用一句话概括 3 篇文章主要内容', 20, ['reading', 'method']),
    kp('chinese.reading.renwu', 'chinese', '现代文阅读', '人物描写与赏析',
      '描写方法分类：外貌/语言/动作/心理/神态+作用模板', ['赏析题 6 题'],
      '6 题能按"方法+效果+情感"答题', 20, ['method', 'reading']),
    kp('chinese.reading.biaoti_zhuzhi', 'chinese', '现代文阅读', '标题含义与主旨',
      '标题双关义=表层+深层；主旨到末段找议论抒情句', ['标题作用题 5 题', '主旨概括 3 题'],
      '5 题能答出双层含义', 20, ['reading', 'method']),
    kp('chinese.reading.sanwen', 'chinese', '现代文阅读', '散文语言品味',
      '修辞赏析模板：手法+内容+情感；关键词换词比较', ['语言赏析 6 题'],
      '6 题按模板完整作答', 20, ['method', 'reading']),
    // 名著与写作
    kp('chinese.books.zhaohuaxishi', 'chinese', '名著导读', '《朝花夕拾》',
      '按篇目卡片化：人物+事件+情感（重点：阿长/藤野/父亲）', ['篇目概括 10 篇', '人物题 5 题'],
      '能概括 10 篇并说出 3 个主要人物形象', 20, ['reading']),
    kp('chinese.books.xiyouji', 'chinese', '名著导读', '《西游记》精读与跳读',
      '精读三打白骨精/三调芭蕉扇；跳读诗词', ['情节概括 8 回', '人物分析 3 题'],
      '能讲出 8 个重点情节', 20, ['reading']),
    kp('chinese.writing.jishi', 'chinese', '写作', '记事写人',
      '一件事写具体：起因+波折+细节+感受', ['片段写作 2 段', '整篇 1 篇'],
      '一篇完整记叙文达 450 字、有细节描写', 30, ['method']),
    kp('chinese.writing.shenti', 'chinese', '写作', '审题立意',
      '圈关键词→定中心→选材料；先列提纲再动笔', ['审题练习 5 题', '列提纲 3 篇'],
      '5 题审题不跑偏', 15, ['method', 'reading']),
    kp('chinese.writing.xijie', 'chinese', '写作', '细节描写与修改',
      '动作分解法：把一个动作拆成 3 个小动作', ['动作描写片段 3 段', '修改自己的作文 1 篇'],
      '片段有"慢镜头"效果', 20, ['method']),

    /* ================= 英语 · 人教版七年级上册 ================= */
    kp('english.starter.letters_phonetics', 'english', 'Starter Unit', '字母与音标',
      '26 个字母大小写规范 + 5 个元音音标认读', ['字母听写 26 个', '音标认读 10 个'],
      '26 个字母听写全对', 15, ['sloppy']),
    kp('english.starter.greetings', 'english', 'Starter Unit', '问候语与课堂用语',
      'Good morning/afternoon/evening 分时段使用', ['情景选择 10 题', '口语问答 5 组'],
      '10 题对 9', 10, ['concept']),
    kp('english.u1.be_verb', 'english', 'Unit 1', 'be 动词 am/is/are',
      '口诀：我用 am，你用 are，is 跟着他她它', ['填 be 动词 12 题', '句型转换 6 题'],
      '12 题对 10', 15, ['concept', 'calc']),
    kp('english.u1.personal_pronoun', 'english', 'Unit 1', '人称代词与形容词性物主代词',
      '表格对比：I-my, you-your, he-his, she-her, it-its', ['填代词 12 题', '选词 8 题'],
      '12 题对 10', 15, ['concept', 'sloppy']),
    kp('english.u1.self_intro', 'english', 'Unit 1', '自我介绍句型',
      "What's your name? My name is... / I'm...", ['情景对话 6 组', '写自我介绍 5 句'],
      '能口头输出 5 句自我介绍', 15, ['method']),
    kp('english.u2.demonstrative', 'english', 'Unit 2', '指示代词 this/that/these/those',
      '近 this/these 远 that/those；this is 不缩写', ['填空 12 题', '变复数句 6 题'],
      '12 题对 10', 15, ['concept']),
    kp('english.u2.plural', 'english', 'Unit 2', '名词单复数',
      '规则变化 4 条（+s/+es/变y为i加es/不变）+ 不规则 5 个', ['变形 10 题', '单句填空 5 题'],
      '10 题对 9', 15, ['concept', 'sloppy']),
    kp('english.u2.family_words', 'english', 'Unit 2', '家庭成员词汇',
      '家谱图记单词：parents/grandparents/uncle/aunt/cousin', ['听写 15 词', '家谱填空 1 题'],
      '15 词对 12', 15, ['sloppy']),
    kp('english.u3.yesno_question', 'english', 'Unit 3', '一般疑问句及回答',
      'Is this/Are these...? 回答用 Yes, it is. / No, it isn\'t.', ['问答配对 10 题', '改一般疑问句 6 题'],
      '10 题对 8', 15, ['concept', 'method']),
    kp('english.u3.possessive', 'english', 'Unit 3', '名词性物主代词与所有格',
      'my-mine, your-yours 分清形容词性和名词性；\'s 所有格', ['填空 12 题'],
      '12 题对 10', 15, ['concept']),
    kp('english.u4.where_question', 'english', 'Unit 4', 'where 特殊疑问句',
      "Where's the...? It's... / Where are...? They're...", ['问答 10 题'],
      '10 题对 8', 15, ['concept']),
    kp('english.u4.preposition', 'english', 'Unit 4', '方位介词 in/on/under',
      '实物演示：把笔放书包上/里/下造句', ['看图填介词 12 题'],
      '12 题对 10', 15, ['concept', 'sloppy']),
    kp('english.grammar.simple_present', 'english', '语法专项', '一般现在时（三单）',
      '三单变化规则：+s/+es/变y为ies；does 用于否定疑问', ['动词填空 12 题', '句型转换 6 题'],
      '12 题对 10', 20, ['concept', 'calc']),
    kp('english.skill.word_memory', 'english', '学习技能', '单词拼读与记忆',
      '按音节拆分记忆：pen-cil-case；每天 10 词滚动复习', ['听写 10 词 ×3 天'],
      '连续 3 天听写 10 词对 8', 15, ['sloppy', 'method']),
    kp('english.skill.sentence_writing', 'english', '学习技能', '简单句书写与大小写标点',
      '句首大写、专有名词大写、句末标点；先例句仿写', ['改错 10 题', '仿写 5 句'],
      '10 题对 8', 15, ['sloppy']),

    /* ================= 预留（七下，占位停用） ================= */
    kp('english.u5.placeholder', 'english', 'Unit 5-9（七下预习）', 'Unit 5-9 词汇与语法',
      '待启用', ['待启用'], '待启用', 15, ['concept'], { term: '七下', enabled: false }),
    kp('math.nextterm.placeholder', 'math', '七下预习', '相交线与平行线等',
      '待启用', ['待启用'], '待启用', 15, ['concept'], { term: '七下', enabled: false }),
    kp('chinese.nextterm.placeholder', 'chinese', '七下预习', '七下课文与名著',
      '待启用', ['待启用'], '待启用', 15, ['reading'], { term: '七下', enabled: false })
  ];

  global.J1KPOINTS = {
    version: '1.0',
    subjects: [
      { id: 'math', name: '数学', icon: '🔢', textbook: '人教版·七年级上册', color: '#2f80ed' },
      { id: 'chinese', name: '语文', icon: '📖', textbook: '部编版·七年级上册', color: '#f59e0b' },
      { id: 'english', name: '英语', icon: '🔤', textbook: '人教版·七年级上册', color: '#22c55e' }
    ],
    kpoints: kpoints,
    causes: [
      { id: 'concept', name: '概念不清' },
      { id: 'method', name: '方法不会' },
      { id: 'reading', name: '审题错误' },
      { id: 'calc', name: '计算失误' },
      { id: 'sloppy', name: '粗心笔误' },
      { id: 'time', name: '时间不够' }
    ],
    scenes: [
      { id: 'hard_task', name: '完成难任务' },
      { id: 'exam_progress', name: '考试进步' },
      { id: 'initiative', name: '主动学习' },
      { id: 'frustration', name: '遇到挫折' },
      { id: 'habit', name: '坚持习惯' }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
