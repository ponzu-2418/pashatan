# clip_model.py
import csv
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

MODEL_NAME = "openai/clip-vit-base-patch16"

# CLIP に伝えるときだけ使う、詳しい言い方
PROMPT_NAMES = {

}

# ① words.csv を読み込んで辞書にする
def load_words(path="words.csv"):
    words = {}
    with open(path, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            words[row["word"]] = {
                "japanese": row["japanese"],
                "explanation": row["explanation"],
            }
    return words


# ② CLIP をまとめたクラス
class ClipJudge:
    def __init__(self, words):
        print("CLIP を読み込み中...")
        self.model = CLIPModel.from_pretrained(MODEL_NAME)
        self.processor = CLIPProcessor.from_pretrained(MODEL_NAME)
        self.words = list(words)
        self.texts = [f"a photo of a {PROMPT_NAMES.get(w, w)}" for w in self.words]
        print("読み込み完了")

    # ③ 写真を受け取って、上位4つの (単語, 確率) を返す
    def top4(self, image):
        inputs = self.processor(text=self.texts, images=image, return_tensors="pt", padding=True)
        outputs = self.model(**inputs)
        probs = outputs.logits_per_image.softmax(dim=1)[0]
        pairs = list(zip(self.words, probs.tolist()))
        pairs.sort(key=lambda p: p[1], reverse=True)
        return pairs[:4]


# ④ このファイルを直接実行したときだけ動くテスト
if __name__ == '__main__':
    words = load_words()
    judge = ClipJudge(words)
    image = Image.open("test.jpg")
    for word, score in judge.top4(image):
        print(word, round(score * 100, 1), "%")