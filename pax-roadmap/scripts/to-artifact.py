"""Turn dist/index.html into artifact.html: drop the document skeleton (the
Artifact host adds its own) and escape U+FFFD, which the publisher rejects."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
s = (root / 'dist/index.html').read_text(encoding='utf-8')
title = re.search(r'<title>.*?</title>', s).group(0)
head = re.search(r'<head>(.*)</head>', s, re.S).group(1)
body = re.search(r'<body>(.*)</body>', s, re.S).group(1)
head = re.sub(r'<meta[^>]*>|<link rel="icon"[^>]*>', '', head).replace(title, '')
out = title + '\n<meta name="claude:viewport-fit-sides" content="cover">\n' + head + body
out = out.replace('�', '\\uFFFD')
(root / 'artifact.html').write_text(out, encoding='utf-8')
print('artifact.html', len(out))
