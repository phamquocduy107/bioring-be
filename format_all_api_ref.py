import re

file_path = r'd:\BTFPT\WDP\bioring-be\plans\business\api-reference.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

def response_replacer(match):
    prefix = match.group(1)
    json_content = match.group(2).strip()
    
    # If already wrapped, skip
    if 'statusCode' in json_content:
        return match.group(0)
        
    # Indent by 2 spaces
    indented_json = '\n'.join('  ' + line for line in json_content.split('\n'))
    
    wrapped = '{\n  "statusCode": 200,\n  "message": "Success",\n  "data": ' + indented_json + '\n}'
    return prefix + '```json\n' + wrapped + '\n```'
    
new_content = re.sub(r'(\*\*Response:\*\*\s*```json\n)([\s\S]*?)\n```', response_replacer, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)
print('Wrapped ALL responses in the entire document')
