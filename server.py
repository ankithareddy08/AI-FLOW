import os
from dotenv import load_dotenv, find_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai  # <-- This is the missing piece!
import base64
import io
import docx 

# 1. LOAD THE HIDDEN KEY (Bulletproof Method)
load_dotenv(find_dotenv()) 
my_secret_key = os.getenv("GEMINI_API_KEY")

# 2. SETUP THE AI BRAIN
genai.configure(api_key=my_secret_key)
model = genai.GenerativeModel('gemini-2.5-flash')

# 3. START FASTAPI
# (Keep your app = FastAPI() and the rest of your code exactly as it is below this line!)

# 3. START FASTAPI
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UserRequest(BaseModel):
    action: str
    text: str
    file: str | None = None  

@app.post("/api/run-ai")
async def run_ai(request: UserRequest):
    print(f"Sending to Gemini: {request.action}")
    
    # 4. BUILD THE PROMPTS
    prompt = ""
    if request.action == "Summarize Text":
        prompt = f"Please summarize the provided text/document into 3 to 4 easy-to-read bullet points:\n\n{request.text}"
    elif request.action == "Translate to Hindi":
        prompt = f"Please translate the provided text/document accurately into Hindi. Output ONLY the Hindi translation:\n\n{request.text}"
    elif request.action == "Make Professional":
        prompt = f"Please rewrite the provided text/document to sound highly professional and polite. Keep it concise:\n\n{request.text}"
    elif request.action == "Fix Grammar":
        prompt = f"Please correct all grammatical errors and spelling mistakes in the provided text/document:\n\n{request.text}"

    contents = [prompt]
    
    # 5. THE MAGIC FILE INTERCEPTOR
    if request.file:
        try:
            header, encoded_data = request.file.split(",", 1)
            mime_type = header.split(":")[1].split(";")[0]
            
            # Check if it is a Word Document
            if "wordprocessingml.document" in mime_type or "msword" in mime_type:
                print("Word document detected! Extracting text...")
                
                file_bytes = base64.b64decode(encoded_data)
                doc = docx.Document(io.BytesIO(file_bytes))
                extracted_text = "\n".join([para.text for para in doc.paragraphs])
                
                contents = [prompt + "\n\n--- Document Content ---\n" + extracted_text]
                print("Text successfully extracted and sent to AI.")
                
            # If it's an Image or PDF, let Gemini handle it natively
            else:
                file_part = {
                    "mime_type": mime_type,
                    "data": encoded_data
                }
                contents.append(file_part)
                print(f"Attached native file type: {mime_type}")
                
        except Exception as e:
            print(f"Error reading file: {e}")
            return {"result": "There was an error reading your file. Please try pasting the text instead."}

    # 6. CALL THE API
    try:
        response = model.generate_content(contents)
        return {"result": response.text}
        
    except Exception as e:
        print(f"AI Error: {e}")
        return {"result": f"Sorry, the AI encountered an error: {str(e)}"}