from flask import Flask, request, jsonify
from flask_cors import CORS  # Import CORS
from googletrans import Translator

app = Flask(__name__)

# Enable CORS for all domains (you can restrict this to certain origins if needed)
CORS(app)

translator = Translator()

@app.route('/translate', methods=['POST'])
def translate_text():
    data = request.json

    text_to_translate = data.get('text')
    direction = data.get('direction')

    if not text_to_translate or not direction:
        return jsonify({"error": "Missing required parameters"}), 400

    src_lang = ''
    dest_lang = ''
    original_lang_name = ''
    translated_lang_name = ''

    # Map directions to language codes
    if direction == '1':  # English to Hindi
        src_lang = 'en'
        dest_lang = 'hi'
        original_lang_name = 'English'
        translated_lang_name = 'Hindi'
    elif direction == '2':  # English to Marathi
        src_lang = 'en'
        dest_lang = 'mr'
        original_lang_name = 'English'
        translated_lang_name = 'Marathi'
    elif direction == '3':  # Hindi to English
        src_lang = 'hi'
        dest_lang = 'en'
        original_lang_name = 'Hindi'
        translated_lang_name = 'English'
    elif direction == '4':  # Marathi to English
        src_lang = 'mr'
        dest_lang = 'en'
        original_lang_name = 'Marathi'
        translated_lang_name = 'English'
    elif direction == '5':  # Hindi to Marathi
        src_lang = 'hi'
        dest_lang = 'mr'
        original_lang_name = 'Hindi'
        translated_lang_name = 'Marathi'
    elif direction == '6':  # Marathi to Hindi
        src_lang = 'mr'
        dest_lang = 'hi'
        original_lang_name = 'Marathi'
        translated_lang_name = 'Hindi'

    try:
        # Perform translation
        translated = translator.translate(text_to_translate, src=src_lang, dest=dest_lang)
        return jsonify({
            "original": text_to_translate,
            "original_language": original_lang_name,
            "translated": translated.text,
            "translated_language": translated_lang_name
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)
