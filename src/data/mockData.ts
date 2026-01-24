import { Message, Student, UpcomingActivity, AnalyticsData, QuickAccessItem, ClassResource, Resource,  } from '../types';
export const students: Student[] = [
  {
    id: '000001',
    firstName: 'John',
    lastName: 'Dube',
    overall: 77,
    strength: 'Collaborator',
    performance: 'Constant',
    engagement: 71,
    plan: {
      name: 'Balanced',
      progress: 65,
      potentialOverall: 78,
      eta: 3,
      performance: 'Steady',
      description: 'Balanced development across theory, practical, and collaboration.',
      skills: [
        {
          name: 'Collaboration',
          score: 72,
          subskills: [
            { name: 'Team Communication', score: 75 },
            { name: 'Group Problem Solving', score: 70 }
          ]
        },
        {
          name: 'Theory',
          score: 68,
          subskills: [
            { name: 'Networking Concepts', score: 65 },
            { name: 'Protocol Understanding', score: 70 }
          ]
        }
      ]
    }
  },
  {
    id: '000002',
    firstName: 'David',
    lastName: 'Gumbo',
    overall: 75,
    strength: 'Theorist',
    performance: 'Good',
    engagement: 34,
    plan: {
      name: 'Theory Boost',
      progress: 40,
      potentialOverall: 75,
      eta: 5,
      performance: 'Slow',
      description: 'Focus on deepening theoretical mastery and improving engagement.',
      skills: [
        {
          name: 'Theory',
          score: 75,
          subskills: [
            { name: 'OSI Model', score: 70 },
            { name: 'Routing Algorithms', score: 80 }
          ]
        },
        {
          name: 'Engagement',
          score: 40,
          subskills: [
            { name: 'Participation', score: 35 },
            { name: 'Time on Platform', score: 45 }
          ]
        }
      ]
    }
  },
  {
    id: '000003',
    firstName: 'Thembani',
    lastName: 'Shumba',
    overall: 84,
    strength: 'Practicalist',
    performance: 'Good',
    engagement: 58,
    plan: {
      name: 'Routing',
      progress: 80,
      potentialOverall: 86,
      eta: 2,
      performance: 'Excellent',
      description: 'Advanced practical routing and switching.',
      skills: [
        {
          name: 'Routing',
          score: 85,
          subskills: [
            { name: 'Static Routing', score: 90 },
            { name: 'Dynamic Routing', score: 80 }
          ]
        },
        {
          name: 'Switching',
          score: 80,
          subskills: [
            { name: 'VLANs', score: 75 },
            { name: 'STP', score: 85 }
          ]
        }
      ]
    }
  },
  {
    id: '000004',
    firstName: 'Thabani',
    lastName: 'Moyo',
    overall: 62,
    strength: 'Solo',
    performance: 'Low',
    engagement: 75,
    plan: {
      name: 'Balanced',
      progress: 30,
      potentialOverall: 66,
      eta: 6,
      performance: 'Developing',
      description: 'Supportive structure to improve foundational understanding.',
      skills: [
        {
          name: 'Self-Learning',
          score: 60,
          subskills: [
            { name: 'Video Tutorials', score: 65 },
            { name: 'Self Assessments', score: 55 }
          ]
        },
        {
          name: 'Core Concepts',
          score: 58,
          subskills: [
            { name: 'IP Addressing', score: 60 },
            { name: 'Subnetting', score: 56 }
          ]
        }
      ]
    }
  },
  {
    id: '000005',
    firstName: 'Honest',
    lastName: 'Sibanda',
    overall: 43,
    strength: 'Solo',
    performance: 'Low',
    engagement: 80,
    plan: {
      name: 'Foundational Recovery',
      progress: 25,
      potentialOverall: 50,
      eta: 8,
      performance: 'Recovering',
      description: 'Rebuilding core knowledge and confidence.',
      skills: [
        {
          name: 'Core Networking',
          score: 45,
          subskills: [
            { name: 'Subnetting', score: 40 },
            { name: 'OSI Model', score: 50 }
          ]
        },
        {
          name: 'Practice',
          score: 48,
          subskills: [
            { name: 'Packet Tracer Labs', score: 50 },
            { name: 'Scenario Challenges', score: 45 }
          ]
        }
      ]
    }
  },
  {
    id: '000006',
    firstName: 'Getrude',
    lastName: 'Msizi',
    overall: 88,
    strength: 'Solo',
    performance: 'Good',
    engagement: 55,
    plan: {
      name: 'Balanced',
      progress: 90,
      potentialOverall: 89,
      eta: 1,
      performance: 'Peak',
      description: 'Polishing advanced concepts for excellence.',
      skills: [
        {
          name: 'Advanced Concepts',
          score: 90,
          subskills: [
            { name: 'NAT & PAT', score: 95 },
            { name: 'VPNs', score: 85 }
          ]
        },
        {
          name: 'Soft Skills',
          score: 60,
          subskills: [
            { name: 'Presentation', score: 55 },
            { name: 'Documentation', score: 65 }
          ]
        }
      ]
    }
  },
  {
    id: '000007',
    firstName: 'Pertunia',
    lastName: 'Shambala',
    overall: 78,
    strength: 'Collaborator',
    performance: 'Constant',
    engagement: 68,
    plan: {
      name: 'Switching',
      progress: 70,
      potentialOverall: 80,
      eta: 3,
      performance: 'Steady',
      description: 'Developing switching and teamwork competencies.',
      skills: [
        {
          name: 'Switching',
          score: 75,
          subskills: [
            { name: 'VLAN Setup', score: 72 },
            { name: 'Trunking', score: 78 }
          ]
        },
        {
          name: 'Team Projects',
          score: 68,
          subskills: [
            { name: 'Role Distribution', score: 70 },
            { name: 'Joint Labs', score: 66 }
          ]
        }
      ]
    }
  },
  {
    id: '000008',
    firstName: 'Ropa',
    lastName: 'Dade',
    overall: 78,
    strength: 'Practicalist',
    performance: 'Average',
    engagement: 74,
    plan: {
      name: 'Balanced',
      progress: 55,
       potentialOverall: 80,
      eta: 4,
      performance: 'Improving',
      description: 'Balanced technical and soft skills enhancement.',
      skills: [
        {
          name: 'Practical Labs',
          score: 70,
          subskills: [
            { name: 'Routing', score: 68 },
            { name: 'Switching', score: 72 }
          ]
        },
        {
          name: 'Theory Alignment',
          score: 60,
          subskills: [
            { name: 'Protocol Basics', score: 58 },
            { name: 'Addressing', score: 62 }
          ]
        }
      ]
    }
  },
  {
    id: '000009',
    firstName: 'Alfred',
    lastName: 'Shoko',
    overall: 65,
    strength: 'Solo',
    performance: 'Average',
    engagement: 73,
    plan: {
      name: 'Routing',
      progress: 50,
      potentialOverall: 70,
      eta: 5,
      performance: 'Stable',
      description: 'Self-paced routing mastery with occasional mentor check-ins.',
      skills: [
        {
          name: 'Routing',
          score: 65,
          subskills: [
            { name: 'Static Routes', score: 68 },
            { name: 'RIP/EIGRP', score: 62 }
          ]
        },
        {
          name: 'Documentation',
          score: 55,
          subskills: [
            { name: 'Network Topologies', score: 58 },
            { name: 'Config Tracking', score: 52 }
          ]
        }
      ]
    }
  },
  {
    id: '000010',
    firstName: 'Keith',
    lastName: 'Jones',
    overall: 78,
    strength: 'Theorist',
    performance: 'Average',
    engagement: 79,
    plan: {
      name: 'Balanced',
      progress: 60,
      potentialOverall: 81,
      eta: 4,
      performance: 'Improving',
      description: 'Merging theoretical understanding with practical application.',
      skills: [
        {
          name: 'Theory',
          score: 78,
          subskills: [
            { name: 'Layer Functions', score: 76 },
            { name: 'Encapsulation', score: 80 }
          ]
        },
        {
          name: 'Lab Work',
          score: 65,
          subskills: [
            { name: 'Scenario Simulation', score: 68 },
            { name: 'Config Debugging', score: 62 }
          ]
        }
      ]
    }
  },
  {
    id: '000011',
    firstName: 'Andrew',
    lastName: 'Ncube',
    overall: 44,
    strength: 'Theorist',
    performance: 'Low',
    engagement: 54,
    plan: {
      name: 'Switching',
      progress: 30,
      potentialOverall: 50,
      eta: 6,
      performance: 'Slow Start',
      description: 'Hands-on switching to solidify understanding.',
      skills: [
        {
          name: 'Switching',
          score: 45,
          subskills: [
            { name: 'Basic VLANs', score: 40 },
            { name: 'Port Configuration', score: 50 }
          ]
        },
        {
          name: 'Engagement',
          score: 50,
          subskills: [
            { name: 'Lab Participation', score: 55 },
            { name: 'Class Involvement', score: 45 }
          ]
        }
      ]
    }
  },
  {
    id: '000012',
    firstName: 'Eujin',
    lastName: 'Blank',
    overall: 78,
    strength: 'Practicalist',
    performance: 'Average',
    engagement: 45,
    plan: {
      name: 'Balanced',
      progress: 58,
      potentialOverall: 79,
      eta: 4,
      performance: 'Moderate',
      description: 'Focusing on enhancing practical knowledge with theoretical backup.',
      skills: [
        {
          name: 'Lab Challenges',
          score: 70,
          subskills: [
            { name: 'Router Setup', score: 72 },
            { name: 'Switching Labs', score: 68 }
          ]
        },
        {
          name: 'Concept Mapping',
          score: 60,
          subskills: [
            { name: 'Layer Mapping', score: 58 },
            { name: 'Flow Analysis', score: 62 }
          ]
        }
      ]
    }
  },
  {
    id: '000013',
    firstName: 'John',
    lastName: 'Banisa',
    overall: 63,
    strength: 'Collaborator',
    performance: 'Average',
    engagement: 71,
    plan: {
      name: 'Collaboration Booster',
      progress: 55,
      potentialOverall: 63,
      eta: 4,
      performance: 'Growing',
      description: 'Enhancing collaboration and peer-based learning strategies.',
      skills: [
        {
          name: 'Group Projects',
          score: 60,
          subskills: [
            { name: 'Team Roles', score: 58 },
            { name: 'Shared Responsibility', score: 62 }
          ]
        },
        {
          name: 'Peer Reviews',
          score: 63,
          subskills: [
            { name: 'Feedback Quality', score: 65 },
            { name: 'Constructive Criticism', score: 61 }
          ]
        }
      ]
    }
  }
];



export const messages: Message[] = [
  {
    id: '1',
    sender: 'Chairperson',
    title: 'Scheme Plan Request',
    preview: 'Dear Mr. Blank, I hope this email finds you well...',
    time: '10:31',
    read: false,
    fullContent: `Dear Mr. Blank,

I hope this email finds you well.

As we continue with our planning and development efforts, I kindly request you to share your scheme plan at your earliest convenience. Your insights and detailed proposal will be invaluable in guiding our next steps.

Please let us know if any further information or clarification is required to facilitate the submission. We appreciate your cooperation and look forward to reviewing your plan.

Best regards,
Chairperson`
  },
  {
    id: '2',
    sender: 'Eujin Blank',
    title: 'Will head to the Help Center',
    preview: 'Will head to the Help Center...',
    time: '10:25',
    read: true
  },
  {
    id: '3',
    sender: 'David Gumboreshumaba',
    title: 'Let\'s go',
    preview: 'Good day sir, I just wanted...',
    time: '09:55',
    read: true
  },
  {
    id: '4',
    sender: 'Thabani Moyo',
    title: 'Trueeeeee',
    preview: 'Hie sir, Do we have a lecture tod...',
    time: '08:17',
    read: false
  },
  {
    id: '5',
    sender: 'Thembani Shumba',
    title: 'lol yeah, are you coming to th...',
    preview: 'Morning Mr Blank, I can\'t access...',
    time: '07:48',
    read: false
  },
  {
    id: '6',
    sender: 'Honest Sibanda',
    title: 'great catching up over dinner!!',
    preview: 'Good morning sir, here is the link to...',
    time: '07:25',
    read: true
  },
  {
    id: '7',
    sender: 'Getrude Msizi',
    title: 'yep 👏👏',
    preview: 'yep 👏👏',
    time: '07:24',
    read: true
  },
  {
    id: '8',
    sender: 'Pertunia Shambala',
    title: 'When are you coming back to...',
    preview: 'When are you coming back to...',
    time: '03:31',
    read: true
  }
];

export const upcomingActivities: UpcomingActivity[] = [
  {
    id: '1',
    course: 'HCC301',
    title: 'OSPF Lecturer',
    time: '09:00',
    link: 'https://us02web.zoom.us/j/12345678901'
  },
  {
    id: '2',
    course: 'HCC402',
    title: 'Cloud Security',
    time: '14:00',
    link: 'https://us02web.zoom.us/j/12345678902'
  },
  {
    id: '3',
    course: 'HCC201',
    title: 'OS Architecture',
    time: '15:00',
    link: 'https://us02web.zoom.us/j/12345678903'
  }
];

export const performanceCategories = [
  { name: 'Critical Thinking', value: 85 },
  { name: 'Problem Solving', value: 82 },
  { name: 'Switching', value: 81 },
  { name: 'Routing', value: 80 },
  { name: 'Analytical Thinking', value: 80 }
];

export const userData = {
  name: 'Eujin Blank',
  course: 'HCC301',
  score: 78,
  daysRemaining: 6,
  sessionsAvailable: 4
};

export const mockClasses: ClassResource[] = [
  { id: 'hcc301', name: 'HCC301 - Network Security', documents: 25, images: 10, videos: 5, others: 3 },
  { id: 'hcc302', name: 'HCC302 - Operating Systems', documents: 18, images: 7, videos: 3, others: 1 },
  { id: 'hcc303', name: 'HCC303 - Database Management', documents: 30, images: 12, videos: 8, others: 4 },
  { id: 'hcc304', name: 'HCC304 - Software Engineering', documents: 22, images: 8, videos: 6, others: 2 },
  { id: 'hcc305', name: 'HCC305 - Artificial Intelligence', documents: 15, images: 9, videos: 7, others: 3 },
  { id: 'hcc306', name: 'HCC306 - Cloud Computing', documents: 19, images: 11, videos: 4, others: 2 },
];

export const mockQuickAccess: QuickAccessItem[] = [
  { id: 'f1', name: 'Lecture Notes - Week 5', class: 'HCC301' },
  { id: 'f2', name: 'Lab Exercises', class: 'HCC302' },
  { id: 'f3', name: 'Project Templates', class: 'HCC303' },
  { id: 'f4', name: 'AI Assignment 2', class: 'HCC305' },
  { id: 'f5', name: 'Cloud Setup Guide', class: 'HCC306' },
];

export const mockAnalytics: AnalyticsData = {
  totalResources: 178,
  averageDownloads: 31,
  mostPopularResource: 'Cloud Security Whitepaper',
  topClassEngagement: 'HCC306',
};


export const CLASS_RESOURCES: Record<string, Resource[]> = {
  hcc301: [
    {
      id: '1',
      name: 'Network Security Assignment.pdf',
      type: 'document',
      size: '2.4 MB',
      lastModified: new Date('2025-03-23'),
      tags: ['#homework', '#security'],
      classes: ['HCC301'],
      downloads: 15,
    },
    {
      id: '2',
      name: 'OSPF Configuration Guide.docx',
      type: 'document',
      size: '1.8 MB',
      lastModified: new Date('2025-03-22'),
      tags: ['#guide', '#routing'],
      classes: ['HCC301', 'HCC302'],
      downloads: 23,
    },
    {
      id: '3',
      name: 'Network Topology Diagram.png',
      type: 'image',
      size: '856 KB',
      lastModified: new Date('2025-03-21'),
      tags: ['#diagram', '#topology'],
      classes: ['HCC301'],
      downloads: 31,
    },
    {
      id: '8',
      name: 'Wireshark Traffic Capture.pcapng',
      type: 'other',
      size: '3.1 MB',
      lastModified: new Date('2025-03-20'),
      tags: ['#pcap', '#network-analysis'],
      classes: ['HCC301'],
      downloads: 9,
    },
    {
      id: '9',
      name: 'Firewall Configuration Lab.mp4',
      type: 'video',
      size: '35 MB',
      lastModified: new Date('2025-03-19'),
      tags: ['#video', '#firewall'],
      classes: ['HCC301'],
      downloads: 17,
    },
  ],
  hcc302: [
    {
      id: '4',
      name: 'Operating System Basics.pdf',
      type: 'document',
      size: '1.5 MB',
      lastModified: new Date('2025-03-20'),
      tags: ['#basics'],
      classes: ['HCC302'],
      downloads: 10,
    },
    {
      id: '5',
      name: 'Linux Commands Cheatsheet.txt',
      type: 'document',
      size: '0.5 MB',
      lastModified: new Date('2025-03-19'),
      tags: ['#cli'],
      classes: ['HCC302'],
      downloads: 8,
    },
    {
      id: '10',
      name: 'Kernel Architecture Diagram.svg',
      type: 'image',
      size: '612 KB',
      lastModified: new Date('2025-03-18'),
      tags: ['#diagram', '#kernel'],
      classes: ['HCC302'],
      downloads: 14,
    },
    {
      id: '11',
      name: 'Process Scheduling Explained.pptx',
      type: 'document',
      size: '4.2 MB',
      lastModified: new Date('2025-03-17'),
      tags: ['#scheduling', '#presentation'],
      classes: ['HCC302'],
      downloads: 19,
    },
    {
      id: '12',
      name: 'System Calls Code Samples.zip',
      type: 'other',
      size: '2.0 MB',
      lastModified: new Date('2025-03-16'),
      tags: ['#code', '#syscalls'],
      classes: ['HCC302'],
      downloads: 6,
    },
  ],
  hcc303: [
    {
      id: '6',
      name: 'Database Normalization.pdf',
      type: 'document',
      size: '3.0 MB',
      lastModified: new Date('2025-03-18'),
      tags: ['#database'],
      classes: ['HCC303'],
      downloads: 12,
    },
    {
      id: '7',
      name: 'SQL Joins Explained.mp4',
      type: 'video',
      size: '25 MB',
      lastModified: new Date('2025-03-17'),
      tags: ['#video'],
      classes: ['HCC303'],
      downloads: 18,
    },
    {
      id: '13',
      name: 'ER Diagram for Online Shop.pdf',
      type: 'image',
      size: '1.2 MB',
      lastModified: new Date('2025-03-16'),
      tags: ['#ERD', '#project'],
      classes: ['HCC303'],
      downloads: 21,
    },
    {
      id: '14',
      name: 'Advanced SQL Queries.docx',
      type: 'document',
      size: '2.7 MB',
      lastModified: new Date('2025-03-15'),
      tags: ['#advanced', '#queries'],
      classes: ['HCC303'],
      downloads: 11,
    },
    {
      id: '15',
      name: 'Database Backup Script.sql',
      type: 'other',
      size: '347 KB',
      lastModified: new Date('2025-03-14'),
      tags: ['#backup', '#script'],
      classes: ['HCC303'],
      downloads: 5,
    },
  ],
};

// Replace with your actual data structure
export const mockRecentUploads = [
  { id: '1', name: 'Week 4 Notes', class: 'HCC301', date: '2025-05-29' },
  { id: '2', name: 'OS Lab 2 Submissions', class: 'HCC302', date: '2025-05-28' },
  { id: '3', name: 'Lesson Plan', class: 'Database Security', date: '2025-05-27' },
  { id: '4', name: 'Firewall Config Guide', class: 'Networking', date: '2025-05-26' },
  { id: '5', name: 'Network Fundamentals Test', class: 'HCC303', date: '2025-05-25' },
];
