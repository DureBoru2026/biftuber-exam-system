# PROJECT REPORT & SYSTEM DOCUMENTATION
## Biftu Beri Examination & Grading Portal System
**Author:** Jemal Fano Haji (Project Manager, IT & Coordinator)  
**Target Institution:** Biftu Beri Secondary School  
**Date:** May 2026 G.C / 2018 E.C  

---

## SECTION 1: EXECUTIVE SUMMARY
The Biftu Beri Examination & Grading Portal System is an offline-capable, cloud-native full-stack application engineered to revolutionize preparation for the Ethiopian National Examination (EAES) and automate secondary school classroom grading workflows for Grades 9 through 12. 

The system provides a responsive testing environment, an administrative grade record portal aligning with the standardized **30 Marks (Mid-Exam)** + **70 Marks (Final Exam)** semester evaluation schema, and instantly compiles double-semester academic performances into beautiful, printable, security-stamped digital Report Cards.

Additionally, our platform incorporates state-of-the-art AI integration for automated exam generation (Gemini API proxy mapping), student/parent synchronization portals, and comprehensive CSV batch-export utilities for offline records management.

---

## SECTION 2: SYSTEM ARCHITECTURE & DATA SCHEMAS
This application is built on a highly decoupled modern stack:
- **Client Presentation Layer:** React 18 with Vite, styled with custom high-contrast Tailwind CSS, and using `motion` for physics-based view transitions.
- **Data Persistence & Auth:** Google Firebase Cloud Firestore (NoSQL realtime database) and Firebase Authentication for secure administrative role routing.
- **Server proxy / Ingress:** Node.js Express server to shield Gemini API keys from client browsers on container runtimes.

### core Database Model: `marks` (Firestore Collection)
```json
{
  "studentId": "string (Firebase UID reference)",
  "studentName": "string",
  "studentSid": "string (Unique Student Registration ID Number)",
  "subject": "string (English, Mathematics, Biology, Chemistry, Physics, Civics, IT, etc.)",
  "term": "string (term_1 or term_2)",
  "assessmentType": "string (mid_exam or final_exam)",
  "score": "number (Mid: 0 - 30, Final: 0 - 70)",
  "totalPoints": "number (30 or 70)",
  "recordedBy": "string (Admin UID)",
  "recordedAt": "timestamp (Firestore ServerTimestamp)"
}
```

### core Database Model: `students` (Firestore `/users` Collection sub-profiles)
```json
{
  "uid": "string (Identifier)",
  "fullName": "string",
  "email": "string",
  "role": "string (admin, student)",
  "sid": "string (Unique ID Format: STDT_XXXXX)",
  "grade": "string (9, 10, 11, 12)",
  "stream": "string (general, natural, social)",
  "school": "string",
  "age": "string",
  "address": "string"
}
```

---

## SECTION 3: ACADEMIC EVALUATION & FORMULAS
The system complies strictly with standard school regulations in Ethiopia. The overall annual average performance of the student is computed as follows:

Let $T_{1, mid}$ be Term 1 Mid Exam score (out of 30) and $T_{1, final}$ be Term 1 Final Exam score (out of 70).
$$T_{1, total} = T_{1, mid} + T_{1, final}$$

Similarly, for Semester 2:
$$T_{2, total} = T_{2, mid} + T_{2, final}$$

For each subject, the cumulative annual average is calculated based on the semesters with recorded data:
$$\text{Subject Annual Average} = \frac{T_{1, total} + T_{2, total}}{\text{Count of semesters where data is available}}$$

### Overall Student Annual Average
If a student is registered for $N$ total subjects:
$$\text{Cumulative Average} = \frac{\sum_{i=1}^{m} \text{Subject Annual Average}_i}{m}$$
Where $m$ is the count of subjects that have at least one term of recorded marks.

### Promotion and Retention Matrix
1. **Promoted (Darbe):** A student is promoted to the next grade if:
   - The Cumulative Average is greater than or equal to **50%**.
   - The count of passed subjects (Average $\ge$ 50) is greater than or equal to half of the subjects with active marks: $\text{Passed Count} \ge \lceil \frac{m}{2} \rceil$.
2. **Retained (Kufe):** If these conditions are not satisfied, the status automatically outputs **"RETAINED / KUFE"** to enforce strict academic standards.

### Grading Scale Mapping:
- **$\ge$ 90%** $\rightarrow$ A+ (Exceptional Mastery)
- **$\ge$ 80%** $\rightarrow$ A (Excellent)
- **$\ge$ 70%** $\rightarrow$ B (Very Good)
- **$\ge$ 60%** $\rightarrow$ C (Satisfactory)
- **$\ge$ 50%** $\rightarrow$ D (Passable)
- **$<$ 50%** $\rightarrow$ F (Incomplete / Failure)

---

## SECTION 4: PPT PRESENTATION SLIDES OUTLINE & SPEAKER SCRIPT
Below is a complete slide-by-slide structure that you can copy-paste directly into your Microsoft PowerPoint or Google Slides presentation template. 

### Slide 1: Welcome & Title Card
* **Title:** Biftu Beri Secondary School Examination and Grading Portal
* **Subtitle:** Modern Cloud-Native & AI-Powered Web platform
* **Authored By:** Jemal Fano Haji (IT Director & Coordinator)
* **Visual Concept:** Minimalist dark cosmic background showing the school's "B" emblem and an elegant computer network logo.
* **Speaker Script:**
> *"Dearest teachers, administrative board, and honored members of the education bureau, welcome. Today, I am incredibly proud to present the Biftu Beri Examination and Grading Portal. We have engineered this cloud-native system to bridge the digital gap in student assessment, providing high-fidelity national exam practices and error-free automated report cards directly tailored for Grades 9 to 12. Let's see how this transforms our academic workflow."*

### Slide 2: The Core Educational Bottlenecks
* **Title:** Current Challenges in Traditional Assessments
* **Bullet Points:**
  - High friction in physical question generation and exam distribution.
  - Manual grading overhead leading to score recording errors and transcription delays.
  - Absence of instant analytics to detect underperforming subjects.
  - High paper costs for mock materials and report sheets.
* **Speaker Script:**
> *"Before development, our school relied heavily on manual paper-based testing. Teachers spent dozens of hours drafting templates, printing costs were immense, and calculating final percentages at the end of Term 2 took days of high stress. Furthermore, a student would only discover their weaknesses weeks after the test, missing critical windows for improvement. Our portal changes all of this."*

### Slide 3: Decoupled Digital Solution
* **Title:** The System Capabilities Matrix
* **Key Visual Columns:**
  1. **Exam Simulation Engine:** Strict timer countdown (up to 120 minutes) representing the real national EAES rules.
  2. **Double-Term Grading (30/70):** Mid examinations (Max 30) + Final examinations (Max 70) with direct academic calculations.
  3. **AI Question Forge:** Seamless integration of server-side Gemini generation to write robust question blueprints instantly.
  4. **Dynamic Data Engine:** Safe cloud storage with immediate offline CSV loading formats.
* **Speaker Script:**
> *"The solution we built rests on four pillars. First, a live exam player that trains students to complete national mocks in real 120-minute timelines. Second, a classroom assessment module conforming to the Oromia guidelines: 30 marks for Mid evaluations, and 70 marks for Finals. Third, an AI Forge powered by Gemini that helps teachers write test items in seconds. And fourth, a fully automated report card outputting double-semester statuses instantly."*

### Slide 4: Grading Schema & Mathematical Rigor
* **Title:** The 30/70 Annual Promotion Formula
* **Bullet Points:**
  - Individual Term score: $S_{\text{Term}} = S_{\text{Mid}} (30) + S_{\text{Final}} (70)$.
  - Multi-semester average calculated automatically for all curriculum subjects.
  - Promotion requirement: Annual Cumulative Average $\ge 50\%$ and $\ge 50\%$ subjects passed.
  - Letter grade scaling from F (under 50) up to A+ (at or above 90).
* **Speaker Script:**
> *"This visual shows our strict academic formula. Unlike legacy spreadsheets where mathematical formulas can be corrupted by mistake, our database handles raw student scores securely. It sums mid and final examinations for Term 1 and Term 2 respectively, combines them into an overall yearly average, and generates letter achievements automatically. This brings perfect transparency to parents."*

### Slide 5: UI Live Demo & User Roles
* **Title:** Admin Dashboard & Student Experience
* **Bullets:**
  - **Admins:** Manage user profiles, mass-import students via CSV, register exams, and input continuous scores.
  - **Students / Parents:** Instant score query tracking, review historic mock attempts with detailed explanations, and print certified Report Cards.
  - **Offline Tools:** Quick-download physical black grading blanks and full grade worksheets.
* **Speaker Script:**
> *"Our user interface is optimized for high readability. Admins can mass-register hundreds of students using standard CSV import templates. When entering grades, scores exceeding the limits are automatically flagged to prevent human error. On the other side, students log in, play practice mocks, and can instantly print their validated annual report cards formatted exactly for A4 portrait paper."*

### Slide 6: Technical Implementation & Hosting Security
* **Title:** decoupeld Modern Tech Stack
* **Bullets:**
  - React 18 / TypeScript: Type-safe, crash-resistant runtime client layout.
  - Tailwind CSS: Dynamic responsive utility margins, eye-friendly light/dark typography.
  - Firebase DB & Authentication: Bank-grade schema validations and protected user roles.
  - Google Cloud Run & Express Proxy: Zero-server maintenance with hidden secret environment keys.
* **Speaker Script:**
> *"Under the hood, this platform is built with cutting-edge engineering. We utilize TypeScript to prevent runtime coding bugs, and Tailwind CSS for mobile-first fluid spacing. All configurations are securely hosted on Google Cloud, guaranteeing zero downtime and absolute security for our student database. The Gemini API keys are fully hidden on the server, keeping student records totally safe."*

### Slide 7: Project Impact & Future Vision
* **Title:** Driving High Performance at Biftu Beri
* **Bullets:**
  - Estimated 85%+ decrease in teacher administrative processing hours.
  - Empowering students to boost state exam pass rates.
  - Scalability options for offline-first cellular capabilities.
  - Custom Oromo / English localized interface dashboards.
* **Speaker Script:**
> *"As we look to deploy, Biftu Beri Secondary School is setting a premium standard for digital education in Oromia. We estimate this system will save teachers over 85% of their manual calculation hours, allowing them to focus purely on interactive instruction. We have localized the interfaces into Afaan Oromoo and English alike, guaranteeing that no student or parent is left behind in this digital journey. Thank you."*

---

## SECTION 5: HOW TO GENERATE PDF & POWERPOINT PPT FILE INSTANTLY
You can turn this Markdown document or the in-app interactive documentation into offline files in under 3 minutes:

### 1. Generating a PDF Document
* **Method A (Direct in App):** Go to the **About** tab inside Biftu Beri, click the dedicated **"Print Academic Report"** button. The page will generate an elegant A4 portrait publication. Choose **"Save as PDF"** in your browser print dialogue.
* **Method B (VS Code Markdown):** Install the extension **Markdown PDF** in VS Code. Simply right-click this document and select **"Markdown PDF: Export (pdf)"**.

### 2. Generating Interactive PPTX Slides
* **Method A (Marp Utility - Recommended):** Install **Marp for VS Code** or go to `https://web.marp.app/`. Marp turns standard Markdown text into highly beautiful presenter slides instantly. Copy this outline, add `---` page breaks, and export as portrait/landscape PowerPoint slides.
* **Method B (Paste to Slides):** Create a blank Google Slides deck with a minimal, elegant theme, and copy the Slide title and bullet text directly from Section 4.

## SECTION 6: SYSTEM UPDATE LOG (May 2026)
- **Excel Module Integration**: Added direct **.xlsx Excel Export** in the Marks component, allowing massive grade data analysis in Microsoft Excel with formatted columns.
- **Dynamic Staff Registration**: Enhanced the User Management portal with **conditional Department fields** that toggle based on user roles, including a subject selection dropdown.
- **Hydration & Reliability Fixes**: Resolved critical HTML nesting issues in `SlideBuilder` where buttons were illegally placed inside other interactive elements, causing rendering warnings.
- **Backend Verification**: Optimized the full-stack `server.ts` initialization logic to ensure consistent database connectivity on first boot.

---
*Created with commitment to educational excellence at Biftu Beri Secondary School.*
