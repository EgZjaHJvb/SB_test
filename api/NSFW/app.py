# pip install fastapi uvicorn
# uvicorn app:app --reload


from fastapi import FastAPI, UploadFile, File, HTTPException
import shutil
import os
 # Import your function from nsfw_detector.py

app = FastAPI()

UPLOAD_DIR = "uploaded_files"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/check_nsfw/")
async def check_nsfw(file: UploadFile = File(...)):
    # Save the uploaded file to disk
    file_location = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Run the NSFW check
    try:
        result = test_file(file_location)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}")

    # Optionally delete the file after checking
    # os.remove(file_location)

    return {"filename": file.filename, "nsfw_status": result}
