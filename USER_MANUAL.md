# BIFTU BERI DIGITAL EXAMINATION & PERFORMANCE PORTAL
## Qajeelfama Fi Haala Itti Fayyadama Sirna Qormaataa (User Manual & System Documentation)

Welcome to the **Biftu Beri Web Examination Standards and Performance Portal**, designed to elevate continuous assessment and official EAES (National Examination) preparation.

---

## 1. Role-Based Access Controls (Daangaa Fayyadama Akkaataa Roolii)

The application implements a strict and secure role-based permission hierarchy:

### A. Student Role (Barattoota)
* **Access (Heeyyama):** Read-only visibility.
* **Actions (Hojiiwwan):**
  * View available, due, and published examinations matching their Grade Level and Academic Stream.
  * Attempt examinations via the **Interactive Exam Player**.
  * View real-time, custom AI performance diagnostics and subject strengths/weaknesses.
  * Access their **Official Annual Report Card** directly on their main dashboard in a pristine, un-editable format.
* **Restrictions (HOJII DOWWAMAN):** Students have absolutely **no permission** to edit, delete, or manually create mark sheets. Action buttons for printing, bulk loading, and PDF exports are securely hidden.

### B. Teacher & Staff Role (Barsiisota & Hojjaatoota)
* **Access (Heeyyama):** Managed write permission.
* **Actions (Hojiiwwan):**
  * Create, build, and publish examinations for their specific subjects.
  * Record and edit student marks manually or via bulk files for their assigned grade levels.
  * View and export classroom report cards.

### C. System Administrator (Giddu-gala Bulchiinsaa)
* **Access (Heeyyama):** Unlimited privileges.
* **Actions (Hojiiwwan):**
  * Manage user profiles (Student IDs, streams, grades, and roles).
  * Auto-fill simulated test performance records to preview design card formats instantly.
  * Download blank grading templates and upload bulk CSV performance records.
  * Export official high-quality PDF report cards and Excel spreadsheets.

---

## 2. Examination Retake Policy & Pass Thresholds (Qajeelfama Darbiinsa Fi Irra-deebi'ii Qormaataa)

We enforce a strict 50% pass threshold rule to mirror EAES qualification guidelines:

1. **Passing Score (Qabxii Darbiinsaa):**
   * **Mid examinations** are scaled out of **30**. A student scoring **15/30 (50%)** or higher passes.
   * **Final examinations** are scaled out of **70**. A student scoring **35/70 (50%)** or higher passes.
   * **General mock tests** require **50%** of total marks to pass.
2. **Passing Lock (Cufiinsa Dabruu):**
   * Once a student attempts an exam and secures a **passing mark (>= 50%)**, they are awarded a status of **PASS / Darbiteetta**.
   * The exam is locked. They cannot retake it to avoid artificial grade inflation.
3. **Failing & Retake Chance (Kufaatii Fi Carraan Irra-deebi'ii):**
   * If a student scores below **50%**, they FAIL.
   * The portal instantly awards them **exactly one (1) additional chance** to retake the examination.
   * On their dashboard, the action button dynamically changes to **"Retake Exam (Last Chance Left) / Irra-deebi'ii Qormaata"**.
4. **Exhausted Attempts (Carraan Sitti Dhume):**
   * If a student fails their second attempt, or utilizes both tries, their attempts are exhausted.
   * The exam card locks permanently, and displays **"Attempts Exhausted / Carraan Dhume"** with no further access.

---

## 3. Guide to Marks Recording & Bulk Uploading (Galmeessa Qabxii Fi Failii Bulk Fe'uu)

Teachers and administrators can record marks through three convenient channels on the **Record & Manage Marks** workspace on the Admin Tab:

### Channel A: Manual Record Entry
1. Select the **Student Name**, **Subject Area**, **Assessment Term (Term 1 / Term 2)**, and **Assessment Type (Continuous Assessment / Mid Exam / Final Exam)**.
2. Provide the numeric score (capped automatically of 10-30 for mid exam, and 70 for final exam).
3. Click **"Record Assessment Mark"** to save securely to Firestore.

### Channel B: Automatic Mock Generative Fill
* For instant previewing of report card formats, click **"Auto-Fill Mock Performance"** at the top. The portal will fill the tables with sample high-fidelity grades.

### Channel C: Class Bulk Upload (Fe'iinsa Haala Salphaatiin)
1. Select the **Grade Level** and **Academic Stream** of the target classroom.
2. Click **"Download Blank Template (CSV)"** under the document center. This generates a CSV file with the required headers pre-arranged for your selected curriculum grade level.
3. Open the file in Excel or Google Sheets and fill in student details:
   - `studentId` or `studentFullName`
   - Numeric columns representing subject marks.
4. Drag and drop or browse to select the completed CSV file inside the **Class Bulk Marks Upload Zone**, then click **"Upload and Record"**. The database is updated in seconds.

---

## 4. Troubleshooting & Connection Safeguards

* **Offline Robustness:** The browser application stores ongoing test attempts inside modern `localStorage` automatically under key `exam_progress_...`. If the internet drops or a power outage occurs, the student can open the browser, reload, and recover their progress instantly without losing their timing cycle.
* **Missing or Insufficient Permission:** Ensure database writes are performed from accounts registered as `admin` or `staff`. Students attempting unauthorized access will be safely blocked by our Firebase collection security rules.

---

*Formulated with Pride for the Academic Advancement of the Biftu Beri Secondary School Scholars.*
