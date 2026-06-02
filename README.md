## Author's note

MathFan started from a very personal place.

I am a parent living in the United States, and I built this project to help my 8-year-old son, who has been struggling with math study. Like many children, he does not need pressure, comparison, or shame. He needs patient practice, small wins, and a way to rebuild confidence step by step.

When a child struggles with math, it can affect more than homework. It can affect how they see themselves. I wanted to create a tool that helps a student feel:

> “I may not know it yet, but I can learn it.”

MathFan was created for my son first, but I believe many students around the world face the same challenge. Some students need more practice. Some need a slower pace. Some need encouragement. Some need the app to remember what they forgot and bring it back at the right time.

That is why MathFan is free of charge.

My hope is that this project can help not only my own child, but also other children, families, and teachers who are looking for a kind, focused, and practical way to make math feel possible again.

# MathFan

**Free, encouraging, adaptive math practice for students who are struggling with math.**

MathFan is a local-first Progressive Web App designed to help elementary and middle-grade students build confidence in math through short, focused, personalized practice sessions.

The goal is simple:

> Help every student feel, “I can get better at math.”

MathFan is free of charge. It is built for families, students, teachers, and anyone who wants a kind, patient, practice-focused math tool without ads, pressure, or shame.

---

## Why MathFan exists

Many students struggle with math not because they are “bad at math,” but because they have small gaps that quietly grow over time.

A student may know most multiplication facts, but miss `7 × 8`.  

They may understand addition, but get stuck when numbers become larger.  

They may practice a lot, but repeat what they already know instead of focusing on what still needs attention.

MathFan is built around a different idea:

> Practice should be kind, focused, and personal.

Instead of forcing every student through the same worksheet, MathFan tracks what each student knows, what they are learning, what they are forgetting, and what needs review. Then it uses that information to guide the next practice session.

The app is especially meant for students who feel discouraged by math. It gives them a safe place to practice, make mistakes, try again, and gradually build confidence.

---

## Core principles

MathFan is built with these principles:

- **Free of charge** — math help should be available to everyone.
- **No shame** — wrong answers are treated as learning signals, not failures.
- **Adaptive practice** — focus more on weak or forgotten skills, less on what is already mastered.
- **Local-first privacy** — student progress is stored on the device by default.
- **Short daily practice** — small, consistent sessions are better than stressful cramming.
- **Encouraging design** — the app celebrates improvement, effort, and persistence.
- **No ads** — students should not be distracted or tracked for advertising.
- **No public leaderboard** — students compete with their own past progress, not with other children.

---

## Features

### Adaptive math practice

MathFan tracks each student’s practice history and uses it to recommend better review sessions. The app focuses on:

- facts the student missed before
- facts that are due for review
- facts that are becoming stronger
- new facts that should be introduced gradually

### Multiplication practice

MathFan supports focused multiplication practice, including configurable factor ranges and session lengths.

Students can practice facts such as:

```text
7 × 8
9 × 6
12 × 4


```

The goal is not only correctness, but also fluency and confidence.

### Addition, subtraction, division, fractions, decimals, and more

MathFan is designed as a growing math practice platform. It supports multiple categories of math practice and can be expanded over time.

Current and planned practice areas include:

- multiplication
- division
- addition
- subtraction
- fractions
- decimals
- rounding
- factors and primes
- word problems
- geometry vocabulary
- challenge problems

### Spaced review

MathFan uses a spaced-review approach so students do not only practice once and forget. Skills come back for review at better times, especially when the student is likely to need reinforcement.

### Progress tracking

Students and parents can review progress over time, including:

- questions practiced
- accuracy
- speed
- daily activity
- streaks
- fact-level mastery
- weak and strong areas
- practice history

### Multiple student profiles

MathFan is designed for families or classrooms where more than one student may use the same device.

### Optional Google Drive sync

By default, MathFan stores progress locally on the device. Optional Google sign-in can sync progress through the user’s own Google Drive app data folder.

### Optional AI tutor

MathFan includes an optional AI tutor mode that can give hints and guiding questions. The tutor is designed to help students think step by step instead of simply giving the answer.

The AI tutor is optional and requires a user-provided Gemini API key.

---

## Privacy and safety

MathFan is designed for students, so privacy and safety matter.

MathFan aims to avoid:

- ads
- public leaderboards
- unnecessary data collection
- open chat with strangers
- exact birthdate collection
- shaming or negative feedback

By default, student data is stored locally in the browser using IndexedDB.

If Google Drive sync is enabled, MathFan stores a progress snapshot in the user’s private Google Drive app data folder. This is meant for cross-device continuity.

Important note: the current Google Drive sync snapshot is not end-to-end encrypted yet. Do not store sensitive personal information in student profile names.

---

## Technology stack

MathFan is built with:

- React
- TypeScript
- Vite
- Progressive Web App support
- IndexedDB / Dexie
- Vitest
- GitHub Pages deployment

---

## Getting started

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/mathfan.git
cd mathfan


```

### 2. Install dependencies

```bash
npm install


```

### 3. Start the development server

```bash
npm run dev


```

### 4. Build for production

```bash
npm run build


```

### 5. Run tests

```bash
npm test


```

---

## Environment variables

Create a `.env` file from `.env.example` if you want Google sign-in and Drive sync:

```bash
cp .env.example .env


```

Then set:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com


```

Do not commit real credentials.

---

## Public release checklist

Before making a deployment public, check:

- `.env` is not committed
- no private keys are committed
- no generated local certificate files are committed
- no personal email addresses are used in tests
- no local machine paths are included in generated docs
- GitHub Actions secrets are configured correctly
- Google OAuth authorized origins match the deployment domain
- the app builds and tests pass

Recommended commands:

```bash
npm test
npm run build


```

If available, also run a secret scan before publishing:

```bash
gitleaks detect --source . -v


```

---

## Deployment

MathFan can be deployed as a static PWA through GitHub Pages or another static hosting service.

For GitHub Pages, make sure the correct base path is configured. If using a custom domain, the base path is usually:

```env
VITE_BASE_PATH=/


```

If deploying under a GitHub Pages project path, it may be:

```env
VITE_BASE_PATH=/mathfan/


```

---

## Contributing

MathFan welcomes contributions that help students learn math with more confidence and less stress.

Good contribution areas include:

- new practice categories
- better accessibility
- improved iPad and mobile layouts
- better progress visualizations
- more encouraging feedback
- parent/teacher dashboards
- privacy improvements
- end-to-end encrypted sync
- translations
- curriculum coverage
- tests and reliability improvements

Please keep the spirit of the project in mind:

> Be kind to the student.  
> 
> Help them improve.  
> 
> Never make them feel small.

---

## Project mission

MathFan is for the student who thinks they are behind.

It is for the student who freezes when they see numbers.

It is for the student who needs one more chance, one more explanation, one more small success.

MathFan is not trying to make math feel like a race.  

It is trying to make math feel possible.

If this project helps even one student say, “I understand it now,” then it is worth building.

---

## License

A license has not been selected yet.

Before publishing this repository publicly, choose a license that matches your goal for the project. If the goal is to make MathFan freely usable and open for community contribution, consider an open-source license such as MIT or Apache-2.0.
