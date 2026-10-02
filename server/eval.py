import os
from PIL import Image, ImageOps
from main import judge, center_crop   # サーバーと同じ CLIP と切り出しを使う

TEST_DIR = "test_photos"

def load_image(path):
    img = Image.open(path)
    img = ImageOps.exif_transpose(img)
    img = img.convert("RGB")
    img.thumbnail((800, 800))
    return img

# ★ 全部の単語の点数をリストで返す（top4 の「上位4つに絞る前」）
def all_scores(image):
    inputs = judge.processor(text=judge.texts, images=image, return_tensors="pt", padding=True)
    outputs = judge.model(**inputs)
    return outputs.logits_per_image.softmax(dim=1)[0].tolist()

# ★ 点数のリストから、いちばん点数が高い単語を返す
def best_word(scores):
    return judge.words[scores.index(max(scores))]

total = 0
ok_plain = 0    # 切り出しなしで当たった数
ok_crop = 0     # 切り出しありで当たった数
ok_avg = 0      # ★ 平均で当たった数

for filename in sorted(os.listdir(TEST_DIR)):
    if not filename.lower().endswith(".jpg"):
        continue
    name = os.path.splitext(filename)[0]         # "key.jpg" → "key"
    answer = name.rsplit("_", 1)[0]              # "cup_1" → "cup"
    img = load_image(f"{TEST_DIR}/{filename}")

    s_plain = all_scores(img)                    # 全体の点数
    s_crop = all_scores(center_crop(img))        # 切り出しの点数
    s_avg = [(a + b) / 2 for a, b in zip(s_plain, s_crop)]   # ★ 単語ごとに平均

    plain = best_word(s_plain)
    crop = best_word(s_crop)
    avg = best_word(s_avg)

    total += 1
    if plain == answer:
        ok_plain += 1
    if crop == answer:
        ok_crop += 1
    if avg == answer:
        ok_avg += 1

    mark = "○" if avg == answer else "×"
    print(f"{mark} {filename}  正解={answer}  なし={plain}  あり={crop}  平均={avg}")

print(f"切り出しなし: {ok_plain}/{total} = {ok_plain / total:.0%}")
print(f"切り出しあり: {ok_crop}/{total} = {ok_crop / total:.0%}")
print(f"平均        : {ok_avg}/{total} = {ok_avg / total:.0%}")