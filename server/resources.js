const resources = [
  {
    id: "computer-science-bs-requirements",
    title: "Computer Science B.S. Degree Requirements",
    url: "https://www.fau.edu/engineering/eecs/undergraduate/computer-science/degree-requirements-bscs/",
    description: "Official Bachelor of Science in Computer Science curriculum, required courses, electives, and degree requirements.",
    category: "Academics", department: "Electrical Engineering and Computer Science", college: "College of Engineering and Computer Science",
    program: "Computer Science", degree: "B.S.", sourceType: "program_requirements", page_type: "degree_requirements", authority_level: "highest", retrieval_priority: 14,
    aliases: ["CS", "BSCS", "computer science major", "bachelor of science computer science"],
    keywords: ["degree requirements", "program requirements", "curriculum", "required courses", "major classes", "electives", "graduation requirements", "degree audit"],
    intents: ["program_requirements", "courses", "graduation", "degree_audit"]
  },
  {
    id: "computer-science-ba-requirements",
    title: "Computer Science B.A. Degree Requirements",
    url: "https://www.fau.edu/engineering/eecs/undergraduate/computer-science-ba/coursedesc/",
    description: "Official Bachelor of Arts in Computer Science course and degree requirements.",
    category: "Academics", department: "Electrical Engineering and Computer Science", college: "College of Engineering and Computer Science",
    program: "Computer Science", degree: "B.A.", sourceType: "program_requirements", page_type: "degree_requirements", authority_level: "highest", retrieval_priority: 13,
    aliases: ["CS", "BA CS", "computer science BA", "bachelor of arts computer science"],
    keywords: ["degree requirements", "program requirements", "curriculum", "required courses", "major classes", "electives"],
    intents: ["program_requirements", "courses", "graduation", "degree_audit"]
  },
  {
    id: "computer-science-program",
    title: "Computer Science Degree Program",
    url: "https://www.fau.edu/engineering/eecs/undergraduate/computer-science/",
    description: "Official overview of FAU Computer Science B.S. and B.A. programs with links to program details.",
    category: "Academics", department: "Electrical Engineering and Computer Science", college: "College of Engineering and Computer Science",
    program: "Computer Science", degree: "B.S. and B.A.", sourceType: "program", page_type: "program", authority_level: "highest", retrieval_priority: 12,
    aliases: ["CS", "computer science major", "computer science bachelors"],
    keywords: ["degree program", "undergraduate", "bachelors", "curriculum", "program requirements"],
    intents: ["program_requirements", "courses", "admissions", "advising"]
  },
  {
    id: "computer-engineering-bs-requirements",
    title: "Computer Engineering B.S. Degree Requirements",
    url: "https://www.fau.edu/engineering/eecs/undergraduate/computer-engineering/degree-requirements-bsce/",
    description: "Official Bachelor of Science in Computer Engineering curriculum and degree requirements.",
    category: "Academics", department: "Electrical Engineering and Computer Science", college: "College of Engineering and Computer Science",
    program: "Computer Engineering", degree: "B.S.", sourceType: "program_requirements", page_type: "degree_requirements", authority_level: "highest", retrieval_priority: 14,
    aliases: ["CE", "BSCE", "computer engineering major"],
    keywords: ["degree requirements", "curriculum", "required courses", "electives", "graduation requirements"],
    intents: ["program_requirements", "courses", "graduation", "degree_audit"]
  },
  {
    id: "artificial-intelligence-ms-requirements",
    title: "Artificial Intelligence M.S. Degree Requirements",
    url: "https://www.fau.edu/engineering/eecs/graduate/ms/artificial-intelligence/degree-reqs/",
    description: "Official degree requirements for the Master of Science with Major in Artificial Intelligence.",
    category: "Academics", department: "Electrical Engineering and Computer Science", college: "College of Engineering and Computer Science",
    program: "Artificial Intelligence", degree: "M.S.", sourceType: "program_requirements", page_type: "degree_requirements", authority_level: "highest", retrieval_priority: 14,
    aliases: ["AI", "MSAI", "AI masters", "artificial intelligence masters"],
    keywords: ["degree requirements", "graduate courses", "curriculum", "thesis", "non thesis", "masters requirements"],
    intents: ["program_requirements", "courses", "graduation", "admissions"]
  },
  {
    id: "biology-bs",
    title: "Biological Sciences B.S. Program",
    url: "https://biology.fau.edu/academics/undergraduate/bs-biology.php",
    description: "Official FAU Biological Sciences Bachelor of Science program and curriculum information.",
    category: "Academics", department: "Biological Sciences", college: "Charles E. Schmidt College of Science",
    program: "Biology", degree: "B.S.", sourceType: "program", page_type: "program", authority_level: "highest", retrieval_priority: 12,
    aliases: ["biology major", "biological sciences", "biology bachelors"],
    keywords: ["degree requirements", "curriculum", "required courses", "major", "bachelor of science"],
    intents: ["program_requirements", "courses", "advising"]
  },
  {
    id: "business-majors",
    title: "College of Business Undergraduate Majors",
    url: "https://business.fau.edu/undergraduate/majors/index.php",
    description: "Official directory of FAU undergraduate business majors and program sheets.",
    category: "Academics", department: "Undergraduate Programs", college: "College of Business",
    program: "Business", degree: "Undergraduate", sourceType: "college", page_type: "program_directory", authority_level: "high", retrieval_priority: 10,
    aliases: ["business degree", "business major", "business school"],
    keywords: ["majors", "degree programs", "program sheets", "courses", "curriculum"],
    intents: ["program_requirements", "courses", "advising", "admissions"]
  },
  {
    id: "eecs-undergraduate-programs",
    title: "EECS Undergraduate Programs",
    url: "https://www.fau.edu/engineering/eecs/undergraduate/",
    description: "Official directory of undergraduate programs in computer science, computer engineering, electrical engineering, data science, and certificates.",
    category: "Academics", department: "Electrical Engineering and Computer Science", college: "College of Engineering and Computer Science",
    sourceType: "department", page_type: "program_directory", authority_level: "high", retrieval_priority: 10,
    aliases: ["EECS programs", "engineering programs"],
    keywords: ["computer science", "computer engineering", "electrical engineering", "data science", "undergraduate programs"],
    intents: ["program_requirements", "courses", "admissions", "advising"]
  },
  {
    id: "university-catalog",
    title: "FAU University Catalog",
    url: "https://www.fau.edu/registrar/university-catalog/",
    description: "The current official FAU catalog for academic programs, policies, courses, and university requirements.",
    category: "Academics", department: "Registrar", college: "University",
    sourceType: "catalog", page_type: "catalog", authority_level: "highest", retrieval_priority: 12,
    aliases: ["catalog", "course catalog", "academic catalog"],
    keywords: ["degree requirements", "programs", "courses", "policies", "university requirements"],
    intents: ["program_requirements", "courses", "graduation", "student_records"]
  },
  {
    id: "university-degree-requirements",
    title: "University Degree Requirements",
    url: "https://www.fau.edu/registrar/university-catalog/catalog/degree-req/",
    description: "Official university-wide undergraduate degree and graduation requirements.",
    category: "Academics", department: "Registrar", college: "University",
    sourceType: "catalog", page_type: "degree_requirements", authority_level: "highest", retrieval_priority: 11,
    aliases: ["graduation requirements", "general degree requirements"],
    keywords: ["degree requirements", "university requirements", "graduation", "bachelors"],
    intents: ["program_requirements", "graduation", "degree_audit"]
  },
  {
    id: "registrar", title: "Registrar", url: "https://www.fau.edu/registrar/",
    description: "Registration, transcripts, enrollment verification, forms, graduation, and student records.",
    category: "Academics", department: "Registrar", college: "University", sourceType: "centralized_academic", page_type: "service", authority_level: "high", retrieval_priority: 10,
    aliases: ["student records office", "records office"], keywords: ["register", "transcript", "withdraw", "drop", "graduation", "records", "forms"],
    intents: ["registration", "withdrawal", "graduation", "transcripts", "student_records", "holds", "contact"]
  },
  {
    id: "registration-faqs", title: "Add, Drop, and Withdrawal Instructions", url: "https://www.fau.edu/registrar/registration/faqs/",
    description: "Official instructions for adding, dropping, or withdrawing from a course and for complete course withdrawal.",
    category: "Academics", department: "Registrar", college: "University", sourceType: "centralized_academic", page_type: "procedure", authority_level: "highest", retrieval_priority: 13,
    aliases: ["add a class", "add a course", "withdraw from a class", "drop a course", "withdrawal FAQ"], keywords: ["add drop", "withdraw", "drop via web with W grade", "MyFAU", "schedule adjustments"],
    intents: ["registration", "withdrawal"]
  },
  {
    id: "myfau", title: "MyFAU", url: "https://myfau.fau.edu/",
    description: "FAU student portal for registration, class schedules, account services, email, and student tools.",
    category: "Student Portal", department: "IT / Student Services", college: "University", sourceType: "portal", page_type: "portal", authority_level: "high", retrieval_priority: 9,
    aliases: ["student portal"], keywords: ["myfau", "register for classes", "class registration", "schedule", "enroll"], intents: ["registration", "billing", "student_records"]
  },
  {
    id: "academic-calendar", title: "Academic Calendar", url: "https://www.fau.edu/registrar/registration/calendar/",
    description: "Important academic dates, deadlines, add/drop windows, final exams, and term schedules.",
    category: "Academics", department: "Registrar", college: "University", sourceType: "centralized_academic", page_type: "academic_calendar", authority_level: "highest", retrieval_priority: 13,
    aliases: ["semester dates", "term dates", "school calendar"], keywords: ["deadline", "last day", "drop add", "final exams", "semester start", "term dates", "graduation date"],
    intents: ["deadlines", "withdrawal", "registration", "graduation"]
  },
  {
    id: "financial-aid", title: "Financial Aid", url: "https://www.fau.edu/finaid/",
    description: "FAFSA, grants, scholarships, loans, verification, aid status, and financial aid contacts.",
    category: "Money", department: "Financial Aid", college: "University", sourceType: "service", page_type: "financial_aid", authority_level: "highest", retrieval_priority: 12,
    aliases: ["FAFSA", "student aid"], keywords: ["financial aid", "scholarship", "loan", "grant", "aid status", "verification"], intents: ["financial_aid", "scholarships", "contact"]
  },
  {
    id: "controller", title: "Tuition and Billing", url: "https://www.fau.edu/controllers-office/student-services/",
    description: "Tuition payment, billing, refunds, payment deadlines, student accounts, and payment plans.",
    category: "Money", department: "Controller", college: "University", sourceType: "service", page_type: "tuition", authority_level: "highest", retrieval_priority: 11,
    aliases: ["student account", "cashier", "pay bill"], keywords: ["tuition", "bill", "billing", "payment", "refund", "account", "fees"], intents: ["billing", "holds", "contact"]
  },
  {
    id: "advising", title: "University Advising Services", url: "https://www.fau.edu/uas/",
    description: "Academic advising, appointment guidance, major exploration, course planning, and student support.",
    category: "Academic Support", department: "Advising", college: "University", sourceType: "service", page_type: "advising", authority_level: "high", retrieval_priority: 8,
    aliases: ["academic advisor", "advisor"], keywords: ["advising", "classes", "major", "appointment", "course plan", "change major"], intents: ["advising", "courses", "degree_audit", "contact"]
  },
  {
    id: "admissions", title: "Admissions Requirements", url: "https://www.fau.edu/registrar/university-catalog/catalog/admissions/",
    description: "Official FAU catalog information for undergraduate, graduate, transfer, and international admissions.",
    category: "Admissions", department: "Admissions", college: "University", sourceType: "catalog", page_type: "admissions", authority_level: "highest", retrieval_priority: 11,
    aliases: ["apply to FAU", "admission requirements"], keywords: ["admissions", "application", "transfer", "international", "requirements"], intents: ["admissions", "transcripts"]
  },
  {
    id: "parking", title: "Parking and Transportation", url: "https://www.fau.edu/parking/", description: "Parking permits, citations, transportation, shuttles, maps, and campus parking rules.",
    category: "Student Life", department: "Parking", college: "University", sourceType: "service", page_type: "parking", authority_level: "high", retrieval_priority: 6,
    aliases: ["parking pass"], keywords: ["parking", "permit", "citation", "shuttle", "transportation"], intents: ["campus_services", "contact"]
  },
  {
    id: "housing", title: "Housing and Residential Education", url: "https://www.fau.edu/housing/", description: "On-campus housing, residence halls, room selection, move-in, rates, and residential life.",
    category: "Student Life", department: "Housing", college: "University", sourceType: "service", page_type: "housing", authority_level: "high", retrieval_priority: 6,
    aliases: ["dorm", "residence hall"], keywords: ["housing", "room selection", "move in", "meal plan"], intents: ["campus_services", "billing", "contact"]
  },
  {
    id: "canvas", title: "Canvas", url: "https://canvas.fau.edu/", description: "FAU Canvas login for courses, assignments, grades, announcements, and online class materials.",
    category: "Technology", department: "IT", college: "University", sourceType: "portal", page_type: "service", authority_level: "high", retrieval_priority: 6,
    aliases: ["learning management system", "LMS"], keywords: ["canvas", "assignment", "course", "grades", "online class"], intents: ["campus_services", "courses"]
  },
  {
    id: "library", title: "FAU Libraries", url: "https://www.fau.edu/library/", description: "Research databases, study rooms, librarians, books, articles, citations, and library hours.",
    category: "Academic Support", department: "Library", college: "University", sourceType: "service", page_type: "library", authority_level: "high", retrieval_priority: 6,
    aliases: ["library database"], keywords: ["library", "research", "database", "study room", "article", "citation"], intents: ["campus_services", "contact"]
  },
  {
    id: "career-center", title: "Career Center", url: "https://www.fau.edu/career/", description: "Resume help, jobs, internships, career fairs, appointments, and interview preparation.",
    category: "Academic Support", department: "Career Services", college: "University", sourceType: "service", page_type: "career", authority_level: "high", retrieval_priority: 6,
    aliases: ["career services"], keywords: ["career", "resume", "internship", "job", "interview", "handshake"], intents: ["campus_services", "contact"]
  },
  {
    id: "student-health", title: "Student Health Services", url: "https://www.fau.edu/shs/", description: "Student health appointments, immunizations, medical forms, insurance, and wellness services.",
    category: "Student Life", department: "Student Health", college: "University", sourceType: "service", page_type: "health", authority_level: "high", retrieval_priority: 6,
    aliases: ["campus health"], keywords: ["health", "doctor", "immunization", "appointment", "medical"], intents: ["campus_services", "contact"]
  },
  {
    id: "counseling", title: "Counseling and Psychological Services", url: "https://www.fau.edu/counseling/", description: "Mental health counseling, crisis support, workshops, wellness resources, and appointments.",
    category: "Student Life", department: "Counseling", college: "University", sourceType: "service", page_type: "counseling", authority_level: "high", retrieval_priority: 6,
    aliases: ["therapy", "mental health"], keywords: ["counseling", "mental health", "stress", "crisis", "wellness"], intents: ["campus_services", "contact"]
  }
];

export const fauResources = resources.map((resource) => ({
  ...resource,
  subcategory: resource.subcategory || resource.page_type,
  searchableText: resource.searchableText || [resource.title, resource.description, resource.program, resource.degree, ...(resource.aliases || []), ...(resource.keywords || [])].filter(Boolean).join(" "),
  last_crawled: resource.last_crawled || null,
  document_id: resource.document_id || resource.id
}));
