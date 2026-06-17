# modules/llm_extractor.py
from openai import OpenAI
from config import Config
import json
import re

# 初始化Qwen客户端（兼容OpenAI SDK）
client = OpenAI(
    api_key=Config.QWEN_API_KEY,
    base_url=Config.QWEN_BASE_URL
)

def extract_key_info_and_audit(markdown_content: str) -> dict:
    """
    输入笔录全文(Markdown)，调用Qwen返回提取的要点和合规审查结果
    """
    # 为防止内容过长，截取前6000字
    truncated_content = markdown_content[:6000]
    
    system_prompt = """你是一名专业的公安案件笔录审查专家，拥有丰富的刑侦和案卷审查经验。你的任务是仔细阅读案件笔录，并严格按照要求提取关键信息和进行合规性审查。"""

    user_prompt = f"""
请仔细阅读以下案件笔录内容，并完成两项任务。

【任务1：要点提取】
请从笔录中提取以下信息，如果笔录中没有明确提及，请填写"未提及"。

需要提取的字段：
- 时间：案发时间、报案时间或询问时间（格式：XXXX年XX月XX日XX时）
- 地点：案发地点或询问地点
- 被询问人姓名：被询问/讯问人的姓名
- 询问人姓名：负责询问的民警姓名
- 记录人姓名：负责记录的民警姓名
- 事件经过：用100字左右概括案件的核心事实和过程
- 涉案金额：案件中涉及的金钱数额（如无则填"未提及"）
- 关键证据：列举笔录中提到的重要证据（如转账记录、聊天截图、证人证言等）

【任务2：合规审查】
请根据以下规则进行合规性审查：

1. 必填项检查：检查上述提取的字段中，哪些是"未提及"的，这些即为"缺失项"
2. 程序瑕疵检查：检查笔录中是否存在以下违规词汇或行为描述：
   - 刑讯逼供、威胁、引诱、欺骗、疲劳审讯
   - 单人询问、未告知权利义务、未签名确认
3. 逻辑矛盾检查：检查笔录内容是否存在前后矛盾或不合理之处，例如：
   - 时间线混乱（如案发时间晚于报案时间）
   - 金额对不上（如分项金额之和与总数不符）
   - 人员关系矛盾
   - 同一事实前后描述不一致

【输出格式要求】
请严格按照以下JSON格式返回，不要添加任何其他文字、注释或说明：

{{
    "extraction": {{
        "时间": "具体时间或未提及",
        "地点": "具体地点或未提及",
        "被询问人姓名": "姓名或未提及",
        "询问人姓名": "姓名或未提及",
        "记录人姓名": "姓名或未提及",
        "事件经过": "概括内容",
        "涉案金额": "金额或未提及",
        "关键证据": "证据列表或未提及"
    }},
    "audit": {{
        "缺失项": ["缺失字段1", "缺失字段2"],
        "程序瑕疵": ["具体瑕疵描述1", "具体瑕疵描述2"],
        "逻辑矛盾": ["具体矛盾描述1", "具体矛盾描述2"],
        "总体风险评级": "高/中/低",
        "审查结论": "综合评述，包含对笔录整体质量、规范性的评价和改进建议"
    }}
}}

【风险评级标准】
- 高：存在重大缺失项（如被询问人姓名、事件经过缺失），或存在刑讯逼供等严重程序瑕疵
- 中：存在一般缺失项（如记录人姓名缺失），或有轻微程序瑕疵或逻辑矛盾
- 低：各项信息完整，无明显瑕疵和矛盾

【笔录内容】
{truncated_content}

请严格按照JSON格式返回，不要添加```json```标记或其他任何额外内容。
"""

    try:
        response = client.chat.completions.create(
            model=Config.QWEN_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,
            max_tokens=2500,
            top_p=0.9
        )
        
        result_text = response.choices[0].message.content
        
        # 打印调试信息
        print("=" * 60)
        print("📤 Qwen API 返回内容:")
        print(result_text[:500] + "..." if len(result_text) > 500 else result_text)
        print("=" * 60)
        
        # 尝试解析JSON
        # 处理可能包裹在```json```或```中的情况
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0]
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0]
        
        # 去除首尾空白
        result_text = result_text.strip()
        
        # 如果结果以 { 开头，直接解析
        if result_text.startswith('{'):
            parsed_result = json.loads(result_text)
        else:
            # 尝试找到 JSON 部分
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                parsed_result = json.loads(json_match.group())
            else:
                raise ValueError("无法从返回内容中提取JSON")
        
        # 确保返回结构完整
        if 'extraction' not in parsed_result:
            parsed_result['extraction'] = {}
        if 'audit' not in parsed_result:
            parsed_result['audit'] = {}
        
        return parsed_result
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON解析失败: {e}")
        print(f"原始内容: {result_text}")
        return {
            "extraction": {},
            "audit": {
                "总体风险评级": "未知",
                "审查结论": f"分析失败: {str(e)}"
            }
        }
    except Exception as e:
        print(f"❌ Qwen API调用失败: {e}")
        return {
            "extraction": {},
            "audit": {
                "总体风险评级": "未知",
                "审查结论": f"分析失败: {str(e)}"
            }
        }