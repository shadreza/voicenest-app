# ☁️ VoiceNest App — Frontend Interface for the Elderly AI Companion

> **Empathetic Voice UI for Human-like AI Interaction**
>
> This frontend application brings to life [VoiceNest](https://voicenest-app.vercel.app), a multilingual voice-based support tool designed for elderly users — powered by AWS Lambda and a suite of AI services.

---

## 📖 About the Project

**VoiceNest** was built with one simple idea: what if we could reduce loneliness using only voice? Elderly users often struggle with smartphones and apps, but speaking comes naturally. Our goal was to build an application where they can just press a button, speak their heart, and receive an intelligent, caring voice reply.

This frontend is powered by a serverless backend using AWS Lambda and multiple AI/ML services. The app provides a clean, accessible user interface with support for more than 40 languages — and works seamlessly on desktop and mobile browsers.

All core features were built from scratch during the AWS Lambda Hackathon 2025.

---

## ✨ Features

* 🎙️ Record voice input (up to 60 seconds)
* 🌍 Detect language and translate responses
* 🤖 Generate AI-based emotional support replies
* 🔊 Play both original voice and AI-generated audio
* 🧠 Smooth UI with language ticker, animations, and feedback
* 📱 Mobile responsive and accessible UX

---

## 💠 Tech Stack

### 🔧 Frameworks & Libraries

* **Next.js 14** — Frontend React framework
* **shadcn/ui** — UI components
* **Framer Motion** — UI animation engine
* **Lucide React** — Icon library

### 🎙️ Browser APIs

* **MediaRecorder API** — Record audio from user’s microphone
* **WAV Conversion** — Encode audio in proper format for Lambda

### ☁️ Backend Integration

* **AWS Lambda via API Gateway** — Core processing endpoint
* **Amazon Transcribe** — Voice-to-text
* **Amazon Comprehend** — Language and sentiment detection
* **Amazon Translate** — Translation engine
* **Amazon Polly** — Voice synthesis
* **Cohere (command-r-plus)** — Empathetic response generation

---

## 🌐 Live Demo

> 🔗 [https://voicenest-app.vercel.app](https://voicenest-app.vercel.app)

The site is fully functional and accessible publicly — no login required.

---

## 📁 File Structure

```
.
├── app/
│   └── page.tsx                 # Audio recording UI and logic
├── components/
│   └── SupportedLanguagesTicker.tsx  # Scrollable animated language list
├── public/                      # App screenshots
├── styles/                      # Global styles
└── .env.local                   # API Gateway URL config
```

---

## 📸 Screenshots

### 🏠 Home Interface

![Homepage](./public/Homepage.png)

### 🎙️ Voice Recording

![Recording](./public/Recording.png)

### ⏳ AI Response Loading

![Waiting](./public/WaitingForResponse.png)

### 🤖 Response + Playback

![Response](./public/Response.png)

---

## 🔌 API Contract

**POST** `${NEXT_PUBLIC_API_URL}/voice`

* **Headers**: `Content-Type: multipart/form-data`
* **Body**: `audio` (Blob)
* **Returns**: `audio/mpeg` stream (base64) and `x-language` header

---

## 🌍 Supported Languages

VoiceNest supports more than **40 spoken languages**:

| Feature       | Service Used      | Notes                         |
| ------------- | ----------------- | ----------------------------- |
| Transcription | Amazon Transcribe | Auto-detects language         |
| Translation   | Amazon Translate  | Seamless translation          |
| Voice Output  | Amazon Polly      | Fallback to English if needed |

Displayed interactively in the UI using a **scrollable ticker**.

---

## 📥 Local Setup Instructions

### 1. Clone and Navigate

```bash
git clone https://github.com/shadreza/voicenest-app.git
cd voicenest-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Add Environment Variable

Create a `.env.local` file with:

```env
NEXT_PUBLIC_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com
```

### 4. Start Development Server

```bash
npm run dev
```

---

## 🏁 Hackathon Compliance: AWS Lambda Usage

VoiceNest (frontend):

* Connects directly to **AWS Lambda via API Gateway**
* Sends recorded audio as `multipart/form-data`
* Receives back AI-generated audio response
* Built from scratch and submitted during Hackathon

Backend Lambda processes input via:

* Amazon Transcribe, Comprehend, Translate, Polly, and Cohere

---

## 💡 Vision for the Future

* Emotion-specific voice modulation
* Conversation history with sentiment timelines
* Mobile-first PWA with push notifications
* Offline fallback using IndexedDB

---

## 👤 Author

**Muhammad Shad Reza**
🌐 [LinkedIn](https://linkedin.com/in/shadreza100) • 💻 [GitHub](https://github.com/shadreza)

---

> 🧡 Helping voices feel heard — one word at a time.
