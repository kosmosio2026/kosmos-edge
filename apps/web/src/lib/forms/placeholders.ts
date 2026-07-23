export const FORM_PLACEHOLDERS = {
  email: "예: user@example.com",
  password: "8자 이상, 영문 소문자와 숫자 포함",
  passwordConfirm: "비밀번호를 다시 입력하세요",

  visitorPin: "숫자 4~6자리 PIN",
  visitorPinConfirm: "PIN을 다시 입력하세요",

  mobilePhone: "예: 01012345678",
  landlinePhone: "예: 0212345678",

  companyName: "예: 코스모스 주식회사",
  managerName: "예: 홍길동",
  operatorName: "예: 김현장",

  plateNumber: "예: 35두4792",

  postcode: "우편번호 검색을 눌러 선택하세요",
  address: "우편번호 검색으로 주소를 선택하세요",
  detailAddress: "예: 101동 1201호",

  parkingLotName: "예: 드림캐슬 주차장",
  parkingLotCode: "예: LOT-001",

  latitude: "예: 37.5665",
  longitude: "예: 126.9780",
} as const;

export const FORM_HINTS = {
  phoneDigitsOnly: "숫자만 입력해도 자동으로 하이픈이 적용됩니다.",
  passwordPolicy:
    "비밀번호는 8자 이상이며, 영문 소문자와 숫자를 각각 1개 이상 포함해야 합니다.",
  visitorPinPolicy: "방문객은 비밀번호 대신 숫자 4~6자리 PIN을 사용합니다.",
  addressSearch: "주소는 우편번호 검색으로 선택하고 상세주소만 직접 입력하세요.",
  coordinateFromAddress:
    "주차장 주소를 저장하면 주소 기반 좌표가 함께 저장됩니다.",
  phoneVerification:
    "휴대전화 인증은 통신사 본인확인 또는 인증번호 방식으로 처리됩니다.",
} as const;
