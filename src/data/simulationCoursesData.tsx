export interface SimulationClassSection {
  id: string;
  classCode: string; // e.g. "CSE281_01"
  groupNumber: string; // "01", "02"
  dayOfWeek: number; // 0 for CN, 1 for T2, 2 for T3, ..., 6 for T7
  periods: number[]; // [1, 2, 3] or [7, 8, 9]
  room: string;
  lecturer: string;
  enrolled: number;
  maxCapacity: number;
  notes?: string;
}

export interface SimulationSubject {
  id: string;
  code: string;
  name: string;
  credits: number;
  department: string;
  sections: SimulationClassSection[];
}

export const TLU_SIMULATION_COURSES: SimulationSubject[] = [
  {
    id: 'sub-cse281',
    code: 'CSE281',
    name: 'Lập trình nâng cao (C++/Java)',
    credits: 3,
    department: 'Khoa CNTT',
    sections: [
      {
        id: 'sec-cse281-01',
        classCode: 'CSE281_01',
        groupNumber: '01',
        dayOfWeek: 1, // Thứ 2
        periods: [1, 2, 3],
        room: '302-A2',
        lecturer: 'TS. Nguyễn Văn Hùng',
        enrolled: 42,
        maxCapacity: 50,
      },
      {
        id: 'sec-cse281-02',
        classCode: 'CSE281_02',
        groupNumber: '02',
        dayOfWeek: 3, // Thứ 4
        periods: [7, 8, 9],
        room: '405-A2',
        lecturer: 'ThS. Lê Thị Mai',
        enrolled: 48,
        maxCapacity: 50,
      },
      {
        id: 'sec-cse281-03',
        classCode: 'CSE281_03',
        groupNumber: '03',
        dayOfWeek: 5, // Thứ 6
        periods: [4, 5, 6],
        room: '201-B1',
        lecturer: 'TS. Nguyễn Văn Hùng',
        enrolled: 30,
        maxCapacity: 50,
      },
    ],
  },
  {
    id: 'sub-cse381',
    code: 'CSE381',
    name: 'Cơ sở dữ liệu',
    credits: 3,
    department: 'Khoa CNTT',
    sections: [
      {
        id: 'sec-cse381-01',
        classCode: 'CSE381_01',
        groupNumber: '01',
        dayOfWeek: 2, // Thứ 3
        periods: [1, 2, 3],
        room: '305-A2',
        lecturer: 'TS. Trần Đình Quân',
        enrolled: 45,
        maxCapacity: 55,
      },
      {
        id: 'sec-cse381-02',
        classCode: 'CSE381_02',
        groupNumber: '02',
        dayOfWeek: 4, // Thứ 5
        periods: [7, 8, 9],
        room: '408-A2',
        lecturer: 'TS. Trần Đình Quân',
        enrolled: 54,
        maxCapacity: 55,
      },
      {
        id: 'sec-cse381-03',
        classCode: 'CSE381_03',
        groupNumber: '03',
        dayOfWeek: 6, // Thứ 7
        periods: [1, 2, 3],
        room: '302-A2',
        lecturer: 'ThS. Hoàng Minh Đức',
        enrolled: 25,
        maxCapacity: 50,
      },
    ],
  },
  {
    id: 'sub-cse484',
    code: 'CSE484',
    name: 'Mạng máy tính & Truyền thông',
    credits: 3,
    department: 'Khoa CNTT',
    sections: [
      {
        id: 'sec-cse484-01',
        classCode: 'CSE484_01',
        groupNumber: '01',
        dayOfWeek: 1, // Thứ 2
        periods: [7, 8, 9],
        room: '501-A2',
        lecturer: 'PGS.TS. Phạm Văn An',
        enrolled: 49,
        maxCapacity: 50,
      },
      {
        id: 'sec-cse484-02',
        classCode: 'CSE484_02',
        groupNumber: '02',
        dayOfWeek: 3, // Thứ 4
        periods: [1, 2, 3],
        room: '501-A2',
        lecturer: 'PGS.TS. Phạm Văn An',
        enrolled: 38,
        maxCapacity: 50,
      },
      {
        id: 'sec-cse484-03',
        classCode: 'CSE484_03',
        groupNumber: '03',
        dayOfWeek: 5, // Thứ 6
        periods: [7, 8, 9],
        room: '308-B1',
        lecturer: 'ThS. Bùi Tuấn Anh',
        enrolled: 44,
        maxCapacity: 50,
      },
    ],
  },
  {
    id: 'sub-math101',
    code: 'MTH101',
    name: 'Giải tích 1',
    credits: 3,
    department: 'Khoa Khoa học Cơ bản',
    sections: [
      {
        id: 'sec-mth101-01',
        classCode: 'MTH101_01',
        groupNumber: '01',
        dayOfWeek: 1, // Thứ 2
        periods: [4, 5, 6],
        room: '202-A1',
        lecturer: 'TS. Vũ Hoàng Long',
        enrolled: 60,
        maxCapacity: 60,
      },
      {
        id: 'sec-mth101-02',
        classCode: 'MTH101_02',
        groupNumber: '02',
        dayOfWeek: 4, // Thứ 5
        periods: [1, 2, 3],
        room: '202-A1',
        lecturer: 'TS. Vũ Hoàng Long',
        enrolled: 52,
        maxCapacity: 60,
      },
    ],
  },
  {
    id: 'sub-math102',
    code: 'MTH102',
    name: 'Đại số tuyến tính',
    credits: 3,
    department: 'Khoa Khoa học Cơ bản',
    sections: [
      {
        id: 'sec-mth102-01',
        classCode: 'MTH102_01',
        groupNumber: '01',
        dayOfWeek: 2, // Thứ 3
        periods: [4, 5, 6],
        room: '301-A1',
        lecturer: 'PGS.TS. Đỗ Thanh Bình',
        enrolled: 47,
        maxCapacity: 55,
      },
      {
        id: 'sec-mth102-02',
        classCode: 'MTH102_02',
        groupNumber: '02',
        dayOfWeek: 5, // Thứ 6
        periods: [1, 2, 3],
        room: '301-A1',
        lecturer: 'PGS.TS. Đỗ Thanh Bình',
        enrolled: 40,
        maxCapacity: 55,
      },
    ],
  },
  {
    id: 'sub-cse485',
    code: 'CSE485',
    name: 'Công nghệ phần mềm & Thiết kế Web',
    credits: 3,
    department: 'Khoa CNTT',
    sections: [
      {
        id: 'sec-cse485-01',
        classCode: 'CSE485_01',
        groupNumber: '01',
        dayOfWeek: 2, // Thứ 3
        periods: [7, 8, 9],
        room: '402-A2',
        lecturer: 'TS. Đặng Thị Thu Hà',
        enrolled: 46,
        maxCapacity: 50,
      },
      {
        id: 'sec-cse485-02',
        classCode: 'CSE485_02',
        groupNumber: '02',
        dayOfWeek: 4, // Thứ 5
        periods: [4, 5, 6],
        room: '402-A2',
        lecturer: 'TS. Đặng Thị Thu Hà',
        enrolled: 45,
        maxCapacity: 50,
      },
      {
        id: 'sec-cse485-03',
        classCode: 'CSE485_03',
        groupNumber: '03',
        dayOfWeek: 6, // Thứ 7
        periods: [7, 8, 9],
        room: '304-B1',
        lecturer: 'ThS. Nguyễn Quốc Trung',
        enrolled: 35,
        maxCapacity: 50,
      },
    ],
  },
  {
    id: 'sub-phy101',
    code: 'PHY101',
    name: 'Vật lý đại cương 1',
    credits: 3,
    department: 'Khoa Khoa học Cơ bản',
    sections: [
      {
        id: 'sec-phy101-01',
        classCode: 'PHY101_01',
        groupNumber: '01',
        dayOfWeek: 3, // Thứ 4
        periods: [4, 5, 6],
        room: '104-B2',
        lecturer: 'TS. Nguyễn Ngọc Nam',
        enrolled: 50,
        maxCapacity: 55,
      },
      {
        id: 'sec-phy101-02',
        classCode: 'PHY101_02',
        groupNumber: '02',
        dayOfWeek: 5, // Thứ 6
        periods: [10, 11, 12],
        room: '104-B2',
        lecturer: 'TS. Nguyễn Ngọc Nam',
        enrolled: 28,
        maxCapacity: 55,
      },
    ],
  },
  {
    id: 'sub-pol101',
    code: 'POL101',
    name: 'Triết học Mác - Lênin',
    credits: 3,
    department: 'Khoa Lý luận Chính trị',
    sections: [
      {
        id: 'sec-pol101-01',
        classCode: 'POL101_01',
        groupNumber: '01',
        dayOfWeek: 1, // Thứ 2
        periods: [10, 11, 12],
        room: 'Hội trường T45',
        lecturer: 'TS. Trần Thị Hồng',
        enrolled: 95,
        maxCapacity: 120,
      },
      {
        id: 'sec-pol101-02',
        classCode: 'POL101_02',
        groupNumber: '02',
        dayOfWeek: 3, // Thứ 4
        periods: [10, 11, 12],
        room: 'Hội trường T45',
        lecturer: 'TS. Trần Thị Hồng',
        enrolled: 110,
        maxCapacity: 120,
      },
    ],
  },
  {
    id: 'sub-eng201',
    code: 'ENG201',
    name: 'Tiếng Anh B1 (Bậc 3)',
    credits: 3,
    department: 'Bộ môn Ngoại ngữ',
    sections: [
      {
        id: 'sec-eng201-01',
        classCode: 'ENG201_01',
        groupNumber: '01',
        dayOfWeek: 2, // Thứ 3
        periods: [1, 2, 3],
        room: '205-A3',
        lecturer: 'ThS. Vũ Thùy Linh',
        enrolled: 38,
        maxCapacity: 40,
      },
      {
        id: 'sec-eng201-02',
        classCode: 'ENG201_02',
        groupNumber: '02',
        dayOfWeek: 4, // Thứ 5
        periods: [1, 2, 3],
        room: '205-A3',
        lecturer: 'ThS. Vũ Thùy Linh',
        enrolled: 39,
        maxCapacity: 40,
      },
      {
        id: 'sec-eng201-03',
        classCode: 'ENG201_03',
        groupNumber: '03',
        dayOfWeek: 6, // Thứ 7
        periods: [4, 5, 6],
        room: '201-A3',
        lecturer: 'ThS. Đỗ Phương Thảo',
        enrolled: 32,
        maxCapacity: 40,
      },
    ],
  },
];
