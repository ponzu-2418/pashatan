# clip_test.py
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

# ① モデルを読み込む（初回だけダウンロードで数分かかる）
model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

# ② 写真と、候補の単語を用意する
image = Image.open("test.jpg")
words = ["cup", "pen", "book", "smartphone", "chair"]
texts = [f"a photo of a {w}" for w in words]

# ③ CLIP に「写真」と「文章」を比べてもらう
inputs = processor(text=texts, images=image, return_tensors="pt", padding=True)
outputs = model(**inputs)
probs = outputs.logits_per_image.softmax(dim=1)[0]

# ④ 結果を表示する
for word, p in zip(words, probs):
    print(word, round(p.item() * 100, 1), "%")