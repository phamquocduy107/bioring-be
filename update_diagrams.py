
import re

def process_mf02():
    file_path = r'd:\BTFPT\WDP\bioring-be\plans\manual-testing\MF02-online-order-flow.md'
    with open(file_path, 'r', encoding='utf-8') as f: content = f.read()
    
    content = content.replace(
        'POST /api/v1/engravings/ENGRAVING_ID/biometrics',
        'POST /api/v1/me/engravings/ENGRAVING_ID/biometrics'
    )
    content = content.replace(
        'POST /engravings/:id/biometrics { SW, rawFileUrl, extraData (segment) }',
        'POST /me/engravings/:id/biometrics (Upload audio -> auto-approve -> assetId)'
    )
    content = content.replace(
        'FE GET engraving   th?y biometrics   render',
        'FE GET /viewer-assets   l?y PBR Textures   render Decal Mesh 3D'
    )
    with open(file_path, 'w', encoding='utf-8') as f: f.write(content)

def process_mf03():
    file_path = r'd:\BTFPT\WDP\bioring-be\plans\manual-testing\MF03-offline-order-flow.md'
    with open(file_path, 'r', encoding='utf-8') as f: content = f.read()
    
    content = content.replace(
        '[Staff] POST /engravings/:id/biometrics (SW, FP, HB...)',
        '[Staff] POST /admin/biometric-assets/... (Upload -> Approve -> Assign)'
    )
    content = content.replace(
        'FE GET engraving   th?y biometrics   render',
        'FE GET /viewer-assets   l?y PBR Textures   render Decal Mesh 3D'
    )
    
    # Also fix the confirm placement that I might have missed if it was there
    with open(file_path, 'w', encoding='utf-8') as f: f.write(content)

def process_mf04():
    file_path = r'd:\BTFPT\WDP\bioring-be\plans\manual-testing\MF04-walk-in-guest-flow.md'
    with open(file_path, 'r', encoding='utf-8') as f: content = f.read()
    
    content = content.replace(
        '[Staff] POST /engravings/:id/biometrics (SW, FP, HB...)',
        '[Staff] POST /admin/biometric-assets/... (Upload -> Approve -> Assign)'
    )
    content = content.replace(
        'FE GET engraving   th?y biometrics   render',
        'FE GET /viewer-assets   l?y PBR Textures   render Decal Mesh 3D'
    )
    
    with open(file_path, 'w', encoding='utf-8') as f: f.write(content)

process_mf02()
process_mf03()
process_mf04()
print("Updated diagrams and references in MF02, MF03, MF04")
