import re

file_path = r'd:\BTFPT\WDP\bioring-be\plans\business\api-reference.md'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

viewer_files = '''"viewerFiles": {
        "overlayPng": "http://...",
        "alphaMap": "http://...",
        "heightmap": "http://...",
        "normalMap": "http://...",
        "roughnessMap": "http://...",
        "aoMap": "http://..."
      }'''

review_files = '''"reviewFiles": {
        "viewerFiles": {
          "overlayPng": "http://...",
          "alphaMap": "http://...",
          "heightmap": "http://...",
          "normalMap": "http://...",
          "roughnessMap": "http://...",
          "aoMap": "http://..."
        },
        "productionFiles": {
          "svg": "http://...",
          "waveformPoints": "http://...",
          "audioOriginal": "http://...",
          "audioSegment": "http://..."
        },
        "sourceFiles": {
          "raw": "http://..."
        },
        "debugFiles": {
          "previewPng": "http://...",
          "segmentWav": "http://..."
        }
      }'''

content = content.replace('"viewerFiles": { "...": "..." }', viewer_files)
content = content.replace('"reviewFiles": { "...": "..." }', review_files)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Expanded all viewerFiles and reviewFiles')
