export const taxonomy = {
  name: "FAU Knowledge System",
  categories: {
    Academics: {
      subcategories: [
        "University Catalog",
        "Degree Requirements",
        "Course Descriptions",
        "Academic Policies",
        "Academic Calendar",
        "Course Schedule"
      ],
      defaultAuthority: "highest"
    },
    Enrollment: {
      subcategories: ["Undergraduate Admissions", "Graduate Admissions", "Registrar", "Records", "Transfer Services"],
      defaultAuthority: "high"
    },
    Money: {
      subcategories: ["Financial Aid", "Scholarships", "Tuition & Fees", "Cost of Attendance", "Refund Information"],
      defaultAuthority: "highest"
    },
    "Academic Support": {
      subcategories: ["Academic Advising", "Libraries", "Tutoring", "Career Center"],
      defaultAuthority: "medium"
    },
    "Student Life": {
      subcategories: ["Housing", "Parking & Transportation", "Recreation", "Student Health", "Counseling"],
      defaultAuthority: "medium"
    },
    Programs: {
      subcategories: ["Colleges", "Departments", "Undergraduate Programs", "Graduate Programs", "Individual Degree Programs"],
      defaultAuthority: "high"
    },
    "University Services": {
      subcategories: ["Student Resources", "Contact Information", "Forms", "General University Information"],
      defaultAuthority: "medium"
    }
  },
  authorityLevels: {
    highest: 1.0,
    high: 0.8,
    medium: 0.5,
    low: 0.2
  }
};

export function getAuthorityWeight(level) {
  return taxonomy.authorityLevels[level] ?? 0.5;
}
