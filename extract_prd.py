import docx
import os

def read_docx(file_path):
    doc = docx.Document(file_path)
    full_text = []
    for para in doc.paragraphs:
        full_text.append(para.text)
    return '\n'.join(full_text)

file_path = 'JB_Platform_PRD_v3.docx'
if os.path.exists(file_path):
    text = read_docx(file_path)
    with open('JB_Platform_PRD_v3.txt', 'w', encoding='utf-8') as f:
        f.write(text)
    print(f"Successfully extracted text to JB_Platform_PRD_v3.txt")
else:
    print(f"File {file_path} not found")
