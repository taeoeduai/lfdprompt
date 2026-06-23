import re

files = ['style.css', 'index.html', 'app.js']

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # For color: #FFF1BC -> color: #00b0ff
    content = re.sub(r'color:\s*#FFF1BC', 'color: #00b0ff', content, flags=re.IGNORECASE)
    
    # For border: 2px solid #FFF1BC -> border: 2px solid #00b0ff
    content = re.sub(r'border([^\:]*):\s*([^#]*)#FFF1BC', r'border\1: \2#00b0ff', content, flags=re.IGNORECASE)
    
    # For background: #FFF1BC -> background: linear-gradient(135deg, #00AEEF, #000033); color: #fff
    content = re.sub(r'background:\s*#FFF1BC([^;]*);', r'background: linear-gradient(135deg, #00AEEF, #000033)\1; color: #fff;', content, flags=re.IGNORECASE)

    # For app.js JS background assignments
    content = re.sub(r"\.background\s*=\s*'#FFF1BC'", ".background = 'linear-gradient(135deg, #00AEEF, #000033)'", content, flags=re.IGNORECASE)
    
    # Let's also do `#ffe680` which is another yellow tone used in gradients in style.css
    content = re.sub(r'#ffe680', '#000033', content, flags=re.IGNORECASE)
    # Re-replace #FFF1BC in linear-gradients that were just color substitutions
    content = re.sub(r'#FFF1BC', '#00AEEF', content, flags=re.IGNORECASE)
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
