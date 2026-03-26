from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
import base64
import io
import docx # <-- Our new Word Document reader!

# 1. SETUP THE AI BRAIN
genai.configure(api_key="AIzaSyBEswRVRviylRDBTe-8FJhpXms1onEIUiE")
model = genai.GenerativeModel('gemini-2.5-flash')

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
    
    # 2. BUILD THE PROMPTS
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
    
    # 3. THE MAGIC FILE INTERCEPTOR
    if request.file:
        try:
            header, encoded_data = request.file.split(",", 1)
            mime_type = header.split(":")[1].split(";")[0]
            
            # --- NEW CODE: Check if it is a Word Document ---
            if "wordprocessingml.document" in mime_type or "msword" in mime_type:
                print("Word document detected! Extracting text...")
                
                # Decode the file data
                file_bytes = base64.b64decode(encoded_data)
                
                # Open the Word Doc in memory
                doc = docx.Document(io.BytesIO(file_bytes))
                
                # Rip all the text out of the paragraphs
                extracted_text = "\n".join([para.text for para in doc.paragraphs])
                
                # Add this hidden text to the prompt we send to Gemini!
                contents = [prompt + "\n\n--- Document Content ---\n" + extracted_text]
                print("Text successfully extracted and sent to AI.")
                
            # --- OLD CODE: If it's an Image or PDF, let Gemini handle it ---
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

    # 4. CALL THE API
    try:
        response = model.generate_content(contents)
        return {"result": response.text}
        
    except Exception as e:
        print(f"AI Error: {e}")
        return {"result": f"Sorry, the AI encountered an error: {str(e)}"}