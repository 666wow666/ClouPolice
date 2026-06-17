class BaseAIService {
  constructor() {
    this.workflow1Buffer = '';
    this.workflow1Resolvers = [];
    this.isProcessingWorkflow1 = false;
  }

  async workflow1(message) {
    this.workflow1Buffer = (this.workflow1Buffer ? this.workflow1Buffer + '\n' : '') + message;

    if (this.isProcessingWorkflow1) {
      return new Promise((resolve, reject) => {
        this.workflow1Resolvers.push({ resolve, reject });
      });
    }

    return new Promise((resolve, reject) => {
      this.workflow1Resolvers.push({ resolve, reject });
      this.processWorkflow1Buffer();
    });
  }

  async processWorkflow1Buffer() {
    if (this.isProcessingWorkflow1 || this.workflow1Buffer.trim() === '') {
      return;
    }

    this.isProcessingWorkflow1 = true;
    const bufferedContent = this.workflow1Buffer;
    this.workflow1Buffer = '';

    try {
      const result = await this.executeRequest([
        { role: 'system', content: this.getWorkflow1Prompt() },
        { role: 'user', content: bufferedContent }
      ], 0.7, 1);

      this.workflow1Resolvers.forEach(item => item.resolve(result));
    } catch (error) {
      this.workflow1Resolvers.forEach(item => item.reject(error));
    } finally {
      this.workflow1Resolvers = [];
      this.isProcessingWorkflow1 = false;

      if (this.workflow1Buffer.trim() !== '') {
        this.processWorkflow1Buffer();
      }
    }
  }

  async workflow2(text, basicInfo) {
    const prompt = this.buildWorkflow2Prompt(text, basicInfo);

    const result = await this.executeRequest([
      { role: 'system', content: this.getWorkflow2Prompt() },
      { role: 'user', content: prompt }
    ], 0.5, 2);

    return result;
  }

  getCurrentTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    return `${year}年${month}月${day}日${hour}时`;
  }

  getWorkflow1Prompt() {
    return `你是一名拥有丰富办案经验的专业刑侦审讯员，严格遵循办案规范，基于客观证据与对话内容开展询问工作。
    你获得的信息将是分散的，请你结合上下文分析提问。
【输出格式】
严格按以下JSON格式输出，不要输出任何其他内容：
{"q1":"问题1内容","s1":分数1,"q2":"问题2内容","s2":分数2,"q3":"问题3内容","s3":分数3,"q4":"问题4内容","s4":分数4,"q5":"问题5内容","s5":分数5}

【规则】
1. 问题要具体、尖锐、简洁、可直接使用
2. 围绕模糊、矛盾、回避、信息缺失等地方提问
3. 每个问题必须对应一个分数（0-100的整数），该分数由分析案件经过后得出，分数越高表示越重要
4. 每次提出五个问题
5. 禁止捏造事实、禁止想象案情、禁止主观臆断、禁止引导性违规提问
6.所有问题必须基于对话原文信息推导，不添加任何未提及的情节、人物、事件
7.问题只针对被询问人提出，不要针对询问人提问`;
  }

  getWorkflow2Prompt() {
    return `你是一名专业的公安笔录记录员。请根据提供的基本信息和录音文本，生成规范的讯问笔录。
    【规则】
    1.区分询问人和被询问人说的话
    2.保留对话中的语气和态度
    2.不得扭曲、篡改、编造内容，若有无法理解的部分以【】标注该部分的头尾
    【输出格式要求】
严格按照以下格式输出，不要添加任何额外内容:
问：
答：`;
  }

  buildWorkflow2Prompt(text, basicInfo) {
    let prompt = '【基本信息】\n';
    prompt += '询问人：' + (basicInfo?.inquirerName || '-') + '\n';
    prompt += '被询问人姓名：' + (basicInfo?.respondentName || '-') + '\n';
    prompt += '身份证号：' + (basicInfo?.idCard || '-') + '\n';
    prompt += '出生日期：' + (basicInfo?.birthDate || '-') + '\n';
    prompt += '年龄：' + (basicInfo?.age || '-') + '\n';
    prompt += '性别：' + (basicInfo?.gender || '-') + '\n';
    prompt += '住址：' + (basicInfo?.address || '-') + '\n';
    prompt += '户籍所在地：' + (basicInfo?.registeredAddress || '-') + '\n';
    prompt += '联系方式：' + (basicInfo?.phone || '-') + '\n';
    prompt += '职业：' + (basicInfo?.occupation || '-') + '\n';
    prompt += '是否为人大代表：' + (basicInfo?.isNPCDeputy || '-') + '\n';
    prompt += '与案件关系：' + (basicInfo?.caseRelation || '-') + '\n';
    prompt += '警情：' + (basicInfo?.caseInfo || '-') + '\n\n';
    prompt += '【录音内容】\n' + text;
    return prompt;
  }

  async executeRequest(messages, temperature, workflowNum = null) {
    throw new Error('executeRequest 方法必须在子类中实现');
  }

  getModelName() {
    throw new Error('getModelName 方法必须在子类中实现');
  }
}

module.exports = { BaseAIService };