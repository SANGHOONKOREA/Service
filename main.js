/****************************************
 1) Firebase 초기화
*****************************************/
const firebaseConfig = {
  apiKey: "AIzaSyCoOg2HPjk-oEhtVrLv3hH-3VLCwa2MAfE",
  authDomain: "sanghoon-d8f1c.firebaseapp.com",
  databaseURL: "https://sanghoon-d8f1c-default-rtdb.firebaseio.com",
  projectId: "sanghoon-d8f1c",
  storageBucket: "sanghoon-d8f1c.appspot.com",
  messagingSenderId: "495391900753",
  appId: "1:495391900753:web:b0d708eeca64fafe562470",
  measurementId: "G-J2E22BW61H"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

/****************************************
 2) 전역 변수
*****************************************/
let currentUser = null;  
let currentUid = null;   
let users = {};          
let schedules = [];
let companyColors = {};
let histories = [];
let historyLimit = 100;
let currentMonthDate = new Date();
let currentWeekDate = new Date();
let editingScheduleId = null;
let timeTableData = [];
let modifiedCells = {}; // 수정된 셀 추적을 위한 객체
let fullscreenMode = false; // 전체화면 모드 상태 변수

function isAdminRole(role){
  return role === "관리자" || role === "일정관리자";
}

/****************************************
 3) 페이지 로드 시 초기 작업
*****************************************/
window.onload = () => { 
  checkAutoLogin();
  // localStorage에서 최종 모드 확인 (기본은 모바일)
  const mode = localStorage.getItem("displayMode") || "mobile";
  const body = document.body;
  const btn = document.getElementById("toggleVersionButton");
  if (mode === "pc") {
    body.classList.add("pc-version");
    if(btn) btn.textContent = "모바일 버전";
  } else {
    body.classList.remove("pc-version");
    if(btn) btn.textContent = "PC 버전";
  }
};

// PC/모바일 토글 기능
function toggleVersion() {
  const body = document.body;
  const btn = document.getElementById("toggleVersionButton");
  if (body.classList.contains("pc-version")) {
    // PC 모드 -> 모바일 모드 전환
    body.classList.remove("pc-version");
    btn.textContent = "PC 버전";
    localStorage.setItem("displayMode", "mobile");
  } else {
    // 모바일 모드 -> PC 모드 전환 (폭을 2배로 확장)
    body.classList.add("pc-version");
    btn.textContent = "모바일 버전";
    localStorage.setItem("displayMode", "pc");
  }
  // 모드 전환 후 달력 재렌더링으로 일정바 위치 및 크기 갱신
  refreshCalendar();
}

/****************************************
 4) Firebase Auth 상태 변화 감지
*****************************************/
auth.onAuthStateChanged(user => {
  if (user) {
    currentUid = user.uid;
    
    // 접속 기록 저장 로직 추가 (여기에 추가)
    db.ref("accessHistory").push({
      userId: user.uid,
      timestamp: new Date().toISOString(),
      timezone: "Asia/Seoul"
    });
    
    db.ref("users/" + user.uid).once("value")
      .then(snap => {
        if (!snap.exists()) {
          alert("DB에 등록되지 않은 사용자입니다. 관리자에게 문의하세요.");
          logout();
          throw new Error("사용자 프로필 없음");
        } else {
          return snap.val();
        }
      })
      .then(userData => {
        if (userData) {
          currentUser = userData;
          document.getElementById("login-container").style.display = "none";
          document.getElementById("main-menu").style.display = "flex";
          document.getElementById("btnAdmin").style.display = (isAdminRole(currentUser.role)) ? "inline-block" : "none";
          // 본사 권한이면 현황 버튼 표시
          document.getElementById("btnStatus").style.display = (currentUser.role === "본사") ? "inline-block" : "none";
          loadAllData().then(() => { 
            showSection("monthly"); 
            // 권한에 따라 필터 표시 제어
            updateFilterVisibility();
          });
        }
      })
      .catch(err => { console.error(err); });
  } else {
    document.getElementById("login-container").style.display = "block";
    document.getElementById("main-menu").style.display = "none";
  }
});

// 권한에 따라 필터 표시 여부를 제어하는 함수
function updateFilterVisibility() {
  const monthCompanyFilterContainer = document.getElementById("monthCompanyFilterContainer");
  const weekCompanyFilterContainer = document.getElementById("weekCompanyFilterContainer");
  
  if (currentUser && currentUser.role === "협력") {
    // 협력 권한인 경우 필터 숨김
    monthCompanyFilterContainer.style.display = "none";
    weekCompanyFilterContainer.style.display = "none";
  } else {
    // 관리자, 본사 권한 등의 경우 필터 표시
    monthCompanyFilterContainer.style.display = "flex";
    weekCompanyFilterContainer.style.display = "flex";
  }
}

function checkAutoLogin(){
  // 자동 로그인 로직 (필요 시 구현)
}

/****************************************
 5) 로그인 / 로그아웃 / 비밀번호 재설정
*****************************************/
// 로그인 성공 시 접속 기록 저장 (login 함수 내부에 추가)
function login(){
  const emailVal = document.getElementById("loginEmail").value.trim();
  const pwVal = document.getElementById("loginPw").value.trim();
  if(!emailVal || !pwVal){ alert("이메일과 비밀번호를 입력하세요"); return; }
  auth.signInWithEmailAndPassword(emailVal, pwVal)
    .then((userCredential) => {
      // 접속 기록 저장
      const uid = userCredential.user.uid;
db.ref("accessHistory").push({
  userId: uid,
  timestamp: new Date().toISOString(),
  timezone: "Asia/Seoul" // 타임존 정보 추가
});
    })
    .catch(err => { alert("로그인 실패: " + err.message); });
}
function logout(){
  if(!confirm("로그아웃 하시겠습니까?")) return;
  auth.signOut();
  currentUser = null; currentUid = null;
  hideAllSections();
  document.getElementById("loginEmail").value = "";
  document.getElementById("loginPw").value = "";
  document.getElementById("login-container").style.display = "block";
  document.getElementById("main-menu").style.display = "none";
}
function resetPassword(){
  const emailVal = document.getElementById("loginEmail").value.trim();
  if(!emailVal){ alert("비밀번호 변경을 위해 이메일을 입력하세요."); return; }
  auth.sendPasswordResetEmail(emailVal)
     .then(() => { alert("비밀번호 변경 이메일이 발송되었습니다. 이메일을 확인하세요."); })
     .catch(err => { alert("비밀번호 변경 이메일 발송 실패: " + err.message); });
}

/****************************************
 6) 전체 데이터 로드
*****************************************/
function loadAllData(){
  const p1 = db.ref("users").once("value").then(snap => {
    if(snap.exists()){
      users = snap.val();
      // 기존 협력 계정에 subCategory가 없으면 기본 "기타"로 지정
      for(const uid in users){
        if(users[uid].role === "협력" && !users[uid].subCategory){
          users[uid].subCategory = "기타";
        }
      }
    }
  });
  const p2 = db.ref("schedules").once("value").then(snap => { if(snap.exists()) schedules = snap.val(); });
  const p3 = db.ref("companyColors").once("value").then(snap => { if(snap.exists()) companyColors = snap.val(); });
  const p4 = db.ref("historyLimit").once("value").then(snap => { if(snap.exists()) historyLimit = snap.val(); });
  const p5 = db.ref("history").once("value").then(snap => {
    if(snap.exists()){
      let temp = [];
      snap.forEach(child => { temp.push({ key: child.key, ...child.val() }); });
      histories = temp;
    }
  });
  
  return Promise.all([p1, p2, p3, p4, p5]).then(() => {
    // 데이터 로드 후 필터 옵션 채우기
    populateCompanyFilters();
    populateUserCompanyFilter(); // 유저 목록 필터도 채우기 추가
    populateStatusUserFilter(); // 상태 페이지 유저 필터도 채우기
  });
}

/****************************************
 7) 섹션 전환
*****************************************/
function showSection(sec){
  hideAllSections();
  
  // 필터 옵션 최신화
  populateCompanyFilters();
  
  // 권한에 따라 필터 표시 제어
  updateFilterVisibility();
  
  if(sec === "monthly"){
    document.getElementById("monthlySection").classList.add("active");
    drawMonthCalendar();
    document.getElementById("btnMonthly").classList.add("active");
  } else if(sec === "weekly"){
    document.getElementById("weeklySection").classList.add("active");
    drawWeekCalendar();
    document.getElementById("btnWeekly").classList.add("active");
  } else if(sec === "status"){
    document.getElementById("statusSection").classList.add("active");
    document.getElementById("btnStatus").classList.add("active");
    // 기본으로 유저 목록 표시
    showStatusPane('user');
  } else if(sec === "admin"){
    if(isAdminRole(currentUser.role)){
      document.getElementById("adminSection").classList.add("active");
      document.getElementById("btnAdmin").classList.add("active");
      showAdminPane("userList");
    } else { alert("관리자 권한이 없습니다."); }
  }
}

function hideAllSections(){
  document.getElementById("monthlySection").classList.remove("active");
  document.getElementById("weeklySection").classList.remove("active");
  document.getElementById("adminSection").classList.remove("active");
  document.getElementById("statusSection") && document.getElementById("statusSection").classList.remove("active");
  document.getElementById("btnMonthly").classList.remove("active");
  document.getElementById("btnWeekly").classList.remove("active");
  document.getElementById("btnAdmin").classList.remove("active");
  document.getElementById("btnStatus") && document.getElementById("btnStatus").classList.remove("active");
}

/****************************************
 8) 권한별 스케줄 접근
*****************************************/
function canAccessSchedule(sch){
  if(!currentUser) return false;
  if(isAdminRole(currentUser.role) || currentUser.role === "본사") return true;
  const schUser = users[sch.userId];
  return schUser ? (schUser.company === currentUser.company) : false;
}
/****************************************
 9) 월간 달력
*****************************************/
function drawMonthCalendar(){
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  document.getElementById("monthLabel").textContent = `${year}년 ${month+1}월`;

  // 업체별 필터 옵션이 비어있다면 채우기
  if (document.getElementById("monthCompanyFilter").options.length <= 1) {
    populateCompanyFilters();
  }

  // 1) 이번 달 정보
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month+1, 0);
  const firstDow = firstDay.getDay();   // 이번 달 1일의 요일(0=일,1=월,...)
  const lastDate = lastDay.getDate();   // 이번 달 마지막 날짜

  // 2) 이전 달 정보 (이전 달의 마지막 날짜 등)
  const prevMonth = (month === 0) ? 11 : (month - 1);
  const prevYear = (month === 0) ? (year - 1) : year;
  const prevLastDate = new Date(prevYear, prevMonth + 1, 0).getDate();

  // 3) 달력 테이블 초기화
  const monthBody = document.getElementById("monthBody");
  monthBody.innerHTML = "";
  let row = document.createElement("tr");

  // 4) 첫 행: 이전 달 날짜 채우기
  //    firstDow만큼 빈 칸이 있었는데, 그 자리에 이전 달 말일들을 넣음
  for(let i = 0; i < firstDow; i++){
    // 예: 요일이 3(수)라면, i=0~2 총 3칸
    //     일,월,화가 이전 달 날짜가 됨
    const pmDay = prevLastDate - (firstDow - (i + 1)); // 역순으로 계산
    const td = document.createElement("td");
    td.innerHTML = `<span class="day-number prev-month">${pmDay}</span>`;

    // 필요하다면 이전 달 날짜도 클릭 시 모달 열리도록 처리
    const pmDateStr = `${prevYear}-${String(prevMonth+1).padStart(2,"0")}-${String(pmDay).padStart(2,"0")}`;
    td.onclick = () => openModal(null, pmDateStr);

    // 시각적으로 구분하기 위해 흐린색
    td.style.color = "#aaa";
    row.appendChild(td);
  }

  // 5) 이번 달 날짜 채우기
  for(let d = 1; d <= lastDate; d++){
    const td = document.createElement("td");
    td.innerHTML = `<span class="day-number">${d}</span>`;
    const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

    td.onclick = () => openModal(null, dateStr);
    row.appendChild(td);

    // 한 주(7일) 단위로 줄바꿈
    if ((firstDow + d) % 7 === 0) {
      monthBody.appendChild(row);
      row = document.createElement("tr");
    }
  }

  // 6) 마지막 행: 남은 칸에 다음 달 날짜 채우기
  if(row.children.length > 0){
    let nextDay = 1;
    while(row.children.length < 7){
      const td = document.createElement("td");
      td.innerHTML = `<span class="day-number next-month">${nextDay}</span>`;

      // 다음 달의 연/월 계산
      const nmMonth = (month === 11) ? 0 : (month + 1);
      const nmYear = (month === 11) ? (year + 1) : year;
      const nmDateStr = `${nmYear}-${String(nmMonth+1).padStart(2,"0")}-${String(nextDay).padStart(2,"0")}`;
      td.onclick = () => openModal(null, nmDateStr);

      // 역시 흐린색 처리
      td.style.color = "#aaa";
      row.appendChild(td);
      nextDay++;
    }
    monthBody.appendChild(row);
  }

  // 7) 스케줄 바(overlay) 초기화
  document.getElementById("monthOverlay").innerHTML = "";

  // 8) 각 주(테이블 행) 단위로 스케줄 바 표시
  const rows = monthBody.querySelectorAll("tr");
  rows.forEach(r => {
    const cells = r.querySelectorAll("td");
    let rowDates = [];

    // 이번 달 / 이전 달 / 다음 달 날짜 구분하여 rowDates에 담기
    for(let i = 0; i < 7; i++){
      const daySpan = cells[i]?.querySelector(".day-number");
      if(!daySpan) {
        rowDates.push(null);
        continue;
      }

      // prev-month / next-month / current-month 구분
      if(daySpan.classList.contains("prev-month")){
        // 이전 달
        const pmDay = parseInt(daySpan.textContent, 10);
        const dateStr = formatDate(prevYear, (prevMonth + 1), pmDay);
        rowDates.push(dateStr);
      }
      else if(daySpan.classList.contains("next-month")){
        // 다음 달
        const nmDay = parseInt(daySpan.textContent, 10);
        const nmMonth = (month === 11) ? 0 : (month + 1);
        const nmYear = (month === 11) ? (year + 1) : year;
        const dateStr = formatDate(nmYear, (nmMonth + 1), nmDay);
        rowDates.push(dateStr);
      }
      else {
        // 이번 달
        const d = parseInt(daySpan.textContent, 10);
        rowDates.push(formatDate(year, (month+1), d));
      }
    }

    // 현재 행(주)에 해당하는 날짜 구간
    const validD = rowDates.filter(x => x);
    if(validD.length < 1) return;
    const rowStart = validD[0], rowEnd = validD[validD.length - 1];

    // 업체별 필터링 및 담당자 필터링 적용
    const selectedCompany = document.getElementById("monthCompanyFilter").value;
    const selectedManager = document.getElementById("monthManagerFilter").value;
    
    const weekly = schedules.filter(sch => {
      // 권한 확인
      if (!canAccessSchedule(sch)) return false;
      
      // 서비스 불가/취소 일정 제외 옵션 확인
      if (document.getElementById("excludeSchedules").checked &&
          (sch.unavailable || sch.status === "cancelled")) return false;
      
      // 날짜 범위 확인
      const inRange = (sch.startDate <= rowEnd && sch.endDate >= rowStart);
      
      // 필터링 조건: 날짜 범위 내에 있고
      let passFilter = inRange;
      
      // 업체 필터가 선택되었으면 업체도 일치해야 함
      if (selectedCompany && passFilter) {
        const userObj = users[sch.userId];
        const managerObj = users[sch.managerId];
        
        passFilter = (
          (userObj && userObj.company && userObj.company.trim() === selectedCompany.trim()) ||
          (managerObj && managerObj.company && managerObj.company.trim() === selectedCompany.trim())
        );
      }
      
      // 담당자 필터가 선택되었으면 담당자도 일치해야 함
      if (selectedManager && passFilter) {
        passFilter = (sch.managerId === selectedManager);
      }
      
      return passFilter;
    });

    let barCount = 0;
    weekly.forEach(sch => {
      // barStart/barEnd는 현재 행(주)에 맞춰 잘라냄
      const barStart = (sch.startDate < rowStart) ? rowStart : sch.startDate;
      const barEnd = (sch.endDate > rowEnd) ? rowEnd : sch.endDate;

      // rowDates 배열에서 시작/끝 인덱스 찾기
      const startIdx = rowDates.findIndex(d => d && d >= barStart);
      let endIdx = -1;
      for(let c = 6; c >= 0; c--){
        if(rowDates[c] && rowDates[c] <= barEnd){
          endIdx = c;
          break;
        }
      }
      if(startIdx < 0 || endIdx < 0) return;

      const startCell = cells[startIdx], endCell = cells[endIdx];
      if(!startCell || !endCell) return;

      // 실제 브라우저 상 위치 계산
      const overlayRect = document.getElementById("monthOverlay").getBoundingClientRect();
      const startRect = startCell.getBoundingClientRect();
      const endRect = endCell.getBoundingClientRect();
      const leftPos = startRect.left - overlayRect.left + 2;
      const rightPos = endRect.right - overlayRect.left - 2;
      const width = rightPos - leftPos;
      const topBase = startRect.top - overlayRect.top + 18;
      const topPos = topBase + (barCount * 18);

      // 업체별 색상 결정 로직
      const userObj = users[sch.userId] || {};
      const comp = userObj.company || "기타";
      let c = "#999"; // 기본값
      if (companyColors[comp]) {
        if (sch.unavailable) {
          // "서비스 불가 일정"이면 unavailable 색상
          c = companyColors[comp].unavailable || "#ccc";
        }
        else if (sch.status === "cancelled") {
          c = companyColors[comp].cancel || "#f00";
        }
        else if (sch.status === "finalized" || sch.status === "일정 변경 / 최종 확정") {
          c = companyColors[comp].final || "#0f0";
        }
        else if (sch.status === "completed") {
          c = companyColors[comp].completed || "#3498db";
        }
        else {
          c = companyColors[comp].normal || "#999";
        }
      }

      // 스케줄 바 생성
      const bar = document.createElement("div");
      bar.className = "schedule-bar";
      bar.style.left = leftPos + "px";
      bar.style.top = topPos + "px";
      bar.style.width = width + "px";
      bar.style.backgroundColor = c;
      
      // 업체명 표시 개선: 엔지니어명 (업체명) - 선박명 형식으로 통일
      bar.textContent = userObj.id + " (" + (userObj.company || "업체 미지정") + ") - " + (sch.lineName || "");

      bar.onclick = (e) => {
        e.stopPropagation();
        openModal(sch.id);
      };
      document.getElementById("monthOverlay").appendChild(bar);
      barCount++;
    });

    // 스케줄 바가 여러 개 겹치면 셀 높이를 늘려줌
    if(barCount > 1){
      const newH = 50 + (barCount - 1) * 18;
      r.querySelectorAll("td").forEach(td => {
        td.style.height = newH + "px";
      });
    }
  });
}

// 이전 달로 이동
function prevMonth(){
  currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
  drawMonthCalendar();
}

// 다음 달로 이동
function nextMonth(){
  currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
  drawMonthCalendar();
}

/****************************************
 10) 주간 달력
*****************************************/
function drawWeekCalendar(){
  const dow = currentWeekDate.getDay();
  const sunday = new Date(currentWeekDate);
  sunday.setDate(currentWeekDate.getDate() - dow);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  document.getElementById("weekLabel").textContent = `${formatDateForLabel(sunday)} ~ ${formatDateForLabel(saturday)}`;
  
  // 업체별 필터 옵션이 비어있다면 채우기
  if (document.getElementById("weekCompanyFilter").options.length <= 1) {
    populateCompanyFilters();
  }
  
  const weekList = document.getElementById("weekList");
  weekList.innerHTML = "";
  
  for(let i = 0; i < 7; i++){
    const dDay = new Date(sunday);
    dDay.setDate(sunday.getDate() + i);
    const dateStr = formatDate(dDay.getFullYear(), dDay.getMonth()+1, dDay.getDate());
    const dayBlock = document.createElement("div");
    dayBlock.className = "week-day-block";
    const h4 = document.createElement("h4");
    h4.textContent = formatDateForLabel(dDay);
    dayBlock.appendChild(h4);
    
    // 업체별 필터링 및 담당자 필터링 적용
    const selectedCompany = document.getElementById("weekCompanyFilter").value;
    const selectedManager = document.getElementById("weekManagerFilter").value;
    
    const daySch = schedules.filter(sch => {
      // 권한 확인
      if (!canAccessSchedule(sch)) return false;
      
      // 서비스 불가/취소 일정 제외 옵션 확인
      if (document.getElementById("excludeSchedules").checked &&
          (sch.unavailable || sch.status === "cancelled")) return false;
      
      // 날짜 범위 확인
      const inRange = (sch.startDate <= dateStr && sch.endDate >= dateStr);
      
      // 필터링 조건: 날짜 범위 내에 있고
      let passFilter = inRange;
      
      // 업체 필터가 선택되었으면 업체도 일치해야 함
      if (selectedCompany && passFilter) {
        const userObj = users[sch.userId];
        const managerObj = users[sch.managerId];
        
        passFilter = (
          (userObj && userObj.company && userObj.company.trim() === selectedCompany.trim()) ||
          (managerObj && managerObj.company && managerObj.company.trim() === selectedCompany.trim())
        );
      }
      
      // 담당자 필터가 선택되었으면 담당자도 일치해야 함
      if (selectedManager && passFilter) {
        passFilter = (sch.managerId === selectedManager);
      }
      
      return passFilter;
    });

    daySch.forEach(sch => {
      const userObj = users[sch.userId] || {};
      const comp = userObj.company || "기타";
      let c = "#999";
      if(companyColors[comp]){
        if(sch.unavailable) {
          c = companyColors[comp].unavailable || "#ccc";
        }
        else if(sch.status === "cancelled"){ 
          c = companyColors[comp].cancel || "#f00"; 
        }
        else if(sch.status === "finalized" || sch.status === "일정 변경 / 최종 확정"){ 
          c = companyColors[comp].final || "#0f0"; 
        }
        else if(sch.status === "completed"){ 
          c = companyColors[comp].completed || "#3498db"; 
        }
        else { 
          c = companyColors[comp].normal || "#999"; 
        }
      }
      const item = document.createElement("div");
      item.className = "schedule-week-item";
      item.onclick = (e)=>{ e.stopPropagation(); openModal(sch.id); };
      const bar = document.createElement("div");
      bar.className = "schedule-color-bar";
      bar.style.backgroundColor = c;
      const content = document.createElement("div");
      content.className = "schedule-week-content";
      content.textContent = `${userObj.id || "미지정"} (${userObj.company || "업체 미지정"}) - ${sch.lineName||''}, IMO:${sch.imoNo||''}, 지역:${sch.regionName||''}`;
      item.appendChild(bar);
      item.appendChild(content);
      dayBlock.appendChild(item);
    });
    dayBlock.onclick = () => openModal(null, dateStr);
    weekList.appendChild(dayBlock);
  }
}
function prevWeek(){ currentWeekDate.setDate(currentWeekDate.getDate()-7); drawWeekCalendar(); }
function nextWeek(){ currentWeekDate.setDate(currentWeekDate.getDate()+7); drawWeekCalendar(); }
/****************************************
 11) 스케줄 모달
*****************************************/
// 스케줄 모달 열기 함수 수정 (SHIPOWNER 필드 추가)
// main.js의 openModal 함수 부분 수정

// openModal 함수 내에서 서비스 완료 상태에서도 저장 버튼 활성화하는 부분 수정
// 아래 코드를 openModal 함수 내의 기존 버튼 상태 처리 부분에 추가/수정

// openModal 함수 수정 - AS No.와 국가 필드 초기화 추가

function openModal(scheduleId = null, dateStr = null){
  editingScheduleId = scheduleId;
  document.getElementById("modal-background").style.display = "block";
  loadCountryList();
  const userRow = document.getElementById("modalUserRow");
  const sel = document.getElementById("modalUserSelect");
  const extraContainer = document.getElementById("additionalEngineerRows");
  extraContainer.innerHTML = "";

  const btnDelete = document.getElementById("btnDeleteSchedule");
  const btnCancel = document.getElementById("btnCancelSchedule");
  const btnFinalize = document.getElementById("btnFinalizeSchedule");
  const btnSave = document.getElementById("btnSaveSchedule");
  const btnSaveOnly = document.getElementById("btnSaveOnly");
  const btnComplete = document.getElementById("btnCompleteService");

  // 초기 상태 설정 - 모든 필드 초기화
  btnDelete.style.display = "none";
  btnCancel.style.display = "none";
  btnFinalize.style.display = "none";
  btnComplete.style.display = "none";
  document.getElementById("scheduleStatusLabel").textContent = "";
  document.getElementById("modalIMONo").value = "";
  document.getElementById("modalShipOwner").value = "";
  document.getElementById("modalLine").value = "";
  document.getElementById("modalHullNo").value = "";
  document.getElementById("modalRegion").value = "";
  document.getElementById("modalDetails").value = "";
  document.getElementById("modalMessage").value = "";
  document.getElementById("modalUnavailable").checked = false;
  
  // ETA, ETB, ETD 필드 초기화
  document.getElementById("modalETA").value = "";
  document.getElementById("modalETB").value = "";
  document.getElementById("modalETD").value = "";
  
// AS No. 필드 초기화 추가
  document.getElementById("modalAsNo").value = "";
  // AS 구분 필드 초기화 추가
  document.getElementById("modalAsType").value = "";
  
  // 국가 필드 초기화 추가
  document.getElementById("modalCountry").value = "";
  
  // IMO 입력 필드에 이벤트 리스너 추가
  const imoInput = document.getElementById("modalIMONo");
  if (imoInput) {
    // 기존 이벤트 리스너 제거 (중복 방지)
    imoInput.removeEventListener('change', handleImoChange);
    imoInput.removeEventListener('blur', handleImoChange);
    
    // 새 이벤트 리스너 추가
    imoInput.addEventListener('change', handleImoChange);
    imoInput.addEventListener('blur', handleImoChange);
  }

  // 서비스 불가 체크박스에 이벤트 핸들러 추가
  document.getElementById("modalUnavailable").onchange = toggleManagerField;

  // 1) 권한별 엔지니어/담당자/체크박스 표시
  if (isAdminRole(currentUser.role) || currentUser.role === "본사") {
    // 관리자/본사: 엔지니어 선택 전체, 본사 담당자 전체, "기타 협력사 포함" 체크박스 보이기
    userRow.style.display = "";
    buildEngineerSelectOptions(sel); // 필터 없음
    buildManagerSelectOptions(document.getElementById("modalManagerSelect"));
    document.getElementById("includeOtherPartnersRow").style.display = "";
    document.getElementById("includeOtherPartnersCheckbox").checked = false;
    document.getElementById("includeOtherPartnersCheckbox").onchange = function(){
      updateEngineerLists();
    };
  } else if (currentUser.role === "협력") {
    // 협력: 엔지니어 선택은 "자신의 업체만", 본사 담당자 전체, "기타 협력사 포함" 체크박스는 숨김
    userRow.style.display = "";
    buildEngineerSelectOptions(sel, null, currentUser.company);
    buildManagerSelectOptions(document.getElementById("modalManagerSelect"));
    document.getElementById("includeOtherPartnersRow").style.display = "none";
  } else {
    // 그 외 권한: 엔지니어/본사 담당자/체크박스 전부 숨김
    userRow.style.display = "none";
    buildEngineerSelectOptions(sel, currentUid);
    document.getElementById("modalManagerSelect").innerHTML = "<option value=''>없음</option>";
    document.getElementById("includeOtherPartnersRow").style.display = "none";
  }

  // 2) scheduleId 유무에 따라 (편집 모드 / 새 스케줄)
  if (scheduleId) {
    // 편집 모드: 기존 스케줄 가져오기
    const sch = schedules.find(x => x.id === scheduleId);
    if (!sch) return;
    if (!canAccessSchedule(sch)) {
      alert("권한 없음");
      closeModal();
      return;
    }

    // 기존 값 채우기
// 기존 값 채우기
    document.getElementById("modalStartDate").value = sch.startDate;
    document.getElementById("modalEndDate").value   = sch.endDate;
    const modalImoInput = document.getElementById("modalIMONo");
    modalImoInput.value = sch.imoNo || "";
    
    // IMO 입력 필드에 이벤트 리스너 추가
    modalImoInput.removeEventListener('change', handleImoChange);
    modalImoInput.removeEventListener('blur', handleImoChange);
    modalImoInput.addEventListener('change', handleImoChange);
    modalImoInput.addEventListener('blur', handleImoChange);
    
    document.getElementById("modalShipOwner").value = sch.shipOwner || "";
    document.getElementById("modalLine").value      = sch.lineName || "";
    document.getElementById("modalHullNo").value    = sch.hullNo || "";
    document.getElementById("modalRegion").value    = sch.regionName || "";
    document.getElementById("modalDetails").value   = sch.details || "";
    document.getElementById("modalMessage").value   = sch.message || "";
    document.getElementById("modalUnavailable").checked = !!sch.unavailable;
    document.getElementById("modalETA").value = sch.eta || "";
    document.getElementById("modalETB").value = sch.etb || "";
    document.getElementById("modalETD").value = sch.etd || "";
    
    // AS No. 값 채우기 추가
    document.getElementById("modalAsNo").value = sch.asNo || "";
    // AS 구분 값 채우기 추가
    document.getElementById("modalAsType").value = sch.asType || "";
    
    // 국가 값 채우기 추가
    document.getElementById("modalCountry").value = sch.country || "";

    // 본사 담당자
    buildManagerSelectOptions(document.getElementById("modalManagerSelect"), sch.managerId);
    // 중요: 원래 담당자 값 저장 (항상 먼저 저장)
    document.getElementById("modalManagerSelect").setAttribute('data-original-value', sch.managerId || '');
    
    // 상태 표시
    if (sch.unavailable) {
      document.getElementById("scheduleStatusLabel").textContent = "서비스 불가";
    } else if (sch.status === "cancelled") {
      document.getElementById("scheduleStatusLabel").textContent = "일정 취소";
    } else if (sch.status === "completed") {
      document.getElementById("scheduleStatusLabel").textContent = "서비스 완료";
    } else if (sch.status === "finalized" || 
             sch.status === "일정 변경 / 최종 확정" || 
             sch.status === "일정 확정") {
      document.getElementById("scheduleStatusLabel").textContent = "일정 확정";
    } else if (sch.status === "일정 등록 대기") {
      document.getElementById("scheduleStatusLabel").textContent = "일정 등록 대기";
    } else if (sch.status === "일정 등록") {
      document.getElementById("scheduleStatusLabel").textContent = "일정 등록";
    } else if (sch.status === "일정 변경") {
      document.getElementById("scheduleStatusLabel").textContent = "일정 변경";
    } else {
      // 기본값 처리
      document.getElementById("scheduleStatusLabel").textContent = "일정 등록";
    }

    // 버튼 및 기타 요소 처리
    document.getElementById("btnSaveSchedule").textContent = "일정 변경";

    // 버튼 표시
    btnSave.textContent = "일정 변경";
    if (isAdminRole(currentUser.role) || currentUser.role === "본사") {
      userRow.style.display = "";
      buildEngineerSelectOptions(sel, sch.userId);
      btnDelete.style.display = "inline-block";
      btnCancel.style.display = "inline-block";
      btnFinalize.style.display = "inline-block";
      btnComplete.style.display = "inline-block";
    } else {
      userRow.style.display = "none";
      btnCancel.style.display = "inline-block";
      btnFinalize.style.display = "inline-block";
      btnComplete.style.display = "inline-block";
    }
    
    // 서비스 완료 상태에서의 버튼 처리
    if (sch.status === "completed") {
      // 저장 버튼은 항상 활성화
      btnSave.disabled = false;
      btnSaveOnly.disabled = false;
      btnCancel.disabled = false;
      btnFinalize.disabled = false;
      btnComplete.disabled = false;
      document.getElementById("btnSendEmail").disabled = false;
    } else {
      btnSave.disabled = false;
      btnSaveOnly.disabled = false;
      btnCancel.disabled = false;
      btnFinalize.disabled = false;
      btnComplete.disabled = false;
      document.getElementById("btnSendEmail").disabled = false;
    }
} else {
    // 신규 등록 모드
    document.getElementById("modalStartDate").value = dateStr || "";
    document.getElementById("modalEndDate").value   = dateStr || "";
    document.getElementById("scheduleStatusLabel").textContent = "일정 등록 대기";
    document.getElementById("btnSaveSchedule").textContent = "일정 추가";
    
    // IMO 입력 필드에 이벤트 리스너 추가
    const modalImoInput = document.getElementById("modalIMONo");
    modalImoInput.value = "";
    modalImoInput.removeEventListener('change', handleImoChange);
    modalImoInput.removeEventListener('blur', handleImoChange);
    modalImoInput.addEventListener('change', handleImoChange);
    modalImoInput.addEventListener('blur', handleImoChange);
    
    // 신규 추가 시에도 저장 버튼 활성화
    btnSave.disabled = false;
    btnSaveOnly.disabled = false;
  }

  // 3) 가용 엔지니어 갱신
  updateAvailableEngineers(
    document.getElementById("modalStartDate").value, 
    document.getElementById("modalEndDate").value
  );
  updateAssignedEngineers(
    document.getElementById("modalStartDate").value,
    document.getElementById("modalEndDate").value
  );
  
  // 서비스 불가 체크박스 상태에 따라 본사 담당자 필드 상태 설정
  toggleManagerField();
}
// 서비스 불가 체크박스 상태에 따라 본사 담당자 필드 상태 변경하는 함수
// 서비스 불가 체크박스 상태에 따라 본사 담당자 필드 상태 변경하는 함수
// 서비스 불가 체크박스 상태에 따라 본사 담당자 필드 상태 변경하는 함수
function toggleManagerField() {
  const isUnavailable = document.getElementById("modalUnavailable").checked;
  const managerSelect = document.getElementById("modalManagerSelect");
  
  // 초기 로드 시 현재 선택된 값 저장
  if (!managerSelect.hasAttribute('data-original-value')) {
    managerSelect.setAttribute('data-original-value', managerSelect.value);
  }
  
  if (isUnavailable) {
    // 서비스 불가 체크됨: 본사 담당자 비활성화 및 "미해당" 표시
    managerSelect.disabled = true;
    managerSelect.style.backgroundColor = '#f0f0f0';
    managerSelect.style.color = '#999';
    
    // 기존 선택된 옵션 기억
    const originalValue = managerSelect.getAttribute('data-original-value');
    
    // 임시 저장
    const currentOptions = [];
    for (let i = 0; i < managerSelect.options.length; i++) {
      currentOptions.push({
        value: managerSelect.options[i].value,
        text: managerSelect.options[i].textContent
      });
    }
    
    // 옵션 초기화 후 "미해당" 옵션만 추가
    managerSelect.innerHTML = '';
    const unavailableOption = document.createElement('option');
    unavailableOption.value = originalValue || ''; // 원래 값 유지
    unavailableOption.textContent = '미해당';
    managerSelect.appendChild(unavailableOption);
  } else {
    // 서비스 불가 체크 해제됨: 본사 담당자 활성화 및 옵션 복원
    managerSelect.disabled = false;
    managerSelect.style.backgroundColor = '';
    managerSelect.style.color = '';
    
    // 원래 값으로 복원
    const originalValue = managerSelect.getAttribute('data-original-value') || '';
    
    // 옵션 다시 빌드
    buildManagerSelectOptions(managerSelect, originalValue);
  }
}
function updateEngineerLists() {
  var sDate = document.getElementById("modalStartDate").value;
  var eDate = document.getElementById("modalEndDate").value;
  updateAvailableEngineers(sDate, eDate);
  updateAssignedEngineers(sDate, eDate);
}

// 업체 필터 옵션을 채우는 함수
function populateCompanyFilters() {
  // 월간 달력 필터
  const monthFilter = document.getElementById("monthCompanyFilter");
  // 주간 달력 필터
  const weekFilter = document.getElementById("weekCompanyFilter");
  
  // 기존 선택값 기억
  const monthSelectedValue = monthFilter.value;
  const weekSelectedValue = weekFilter.value;
  
  // 필터 초기화
  monthFilter.innerHTML = "<option value=''>전체</option>";
  weekFilter.innerHTML = "<option value=''>전체</option>";
  
  // 고유한 업체 집합 수집
  const companies = new Set();
  
  // users에 있는 모든 업체 수집
  for (const uid in users) {
    const company = users[uid].company;
    if (company && company.trim() !== '') {
      companies.add(company.trim());
    }
  }
  
  // 정렬된 업체 배열로 변환
  const sortedCompanies = Array.from(companies).sort();
  
  // 필터 옵션 추가
  sortedCompanies.forEach(company => {
    // 월간 달력 필터에 추가
    const monthOption = document.createElement("option");
    monthOption.value = company;
    monthOption.textContent = company;
    monthFilter.appendChild(monthOption);
    
    // 주간 달력 필터에 추가
    const weekOption = document.createElement("option");
    weekOption.value = company;
    weekOption.textContent = company;
    weekFilter.appendChild(weekOption);
  });
  
  // 이전 선택 상태 복원
  if (monthSelectedValue && Array.from(monthFilter.options).some(opt => opt.value === monthSelectedValue)) {
    monthFilter.value = monthSelectedValue;
  }
  
  if (weekSelectedValue && Array.from(weekFilter.options).some(opt => opt.value === weekSelectedValue)) {
    weekFilter.value = weekSelectedValue;
  }
  
  // 담당자 필터도 함께 채우기
  populateManagerFilters();
}

// 전역 변수에 국가 리스트 저장
var countryList = [];

// 국가 리스트를 온라인에서 불러오는 함수
function loadCountryList() {
  if(countryList.length > 0) return; // 이미 불러왔다면 생략
  fetch("https://raw.githubusercontent.com/umpirsky/country-list/master/data/ko/country.json")
    .then(response => response.json())
    .then(data => {
      // data는 { "AF": "아프가니스탄", "AX": "올란드 제도", ... } 형태이므로 값만 추출
      countryList = Object.values(data).sort();
    })
    .catch(err => console.error("국가 리스트 불러오기 에러:", err));
}


// 사용자가 입력할 때마다 드롭다운 필터링하는 함수
function filterCountryList() {
  const input = document.getElementById("modalCountry");
  const filter = input.value.toLowerCase();
  const dropdown = document.getElementById("countryDropdown");
  dropdown.innerHTML = "";
  if(filter === "") {
    document.getElementById("countryDropdownContainer").style.display = "none";
    return;
  }
  const filtered = countryList.filter(country => country.toLowerCase().includes(filter));
  if(filtered.length === 0) {
    document.getElementById("countryDropdownContainer").style.display = "none";
    return;
  }
  filtered.forEach(country => {
    const li = document.createElement("li");
    li.textContent = country;
    li.style.padding = "4px";
    li.style.cursor = "pointer";
    li.onclick = function() {
      input.value = country;
      document.getElementById("countryDropdownContainer").style.display = "none";
    };
    dropdown.appendChild(li);
  });
  document.getElementById("countryDropdownContainer").style.display = "block";
}



function closeModal(){
  document.getElementById("modal-background").style.display = "none";
  editingScheduleId = null;
}

function deleteSchedule(){
  if (!editingScheduleId) return;
  if (!confirm("정말 삭제하시겠습니까?")) return;
  const idx = schedules.findIndex(x => x.id === editingScheduleId);
  if (idx < 0) return;
  const delObj = schedules[idx];
  schedules.splice(idx, 1);
  db.ref("schedules").set(schedules).then(() => { return loadAllData(); })
  .then(() => {
    recordHistory("삭제", currentUid, delObj);
    alert("삭제 완료");
    closeModal();
    refreshCalendar();
  })
  .catch(err => {
    console.error("삭제 에러:", err);
    alert("삭제 중 에러 발생: " + err.message);
  });
}

function filterShipNameDropdown() {
  const input = document.getElementById("monthShipFilter");
  const filter = input.value.toLowerCase();
  const dropdown = document.getElementById("shipDropdown");
  dropdown.innerHTML = "";
  if (filter === "") {
    document.getElementById("shipDropdownContainer").style.display = "none";
    return;
  }
  // schedules 배열에서 필터에 일치하는 고유 선박명 추출
  let shipNames = new Set();
  schedules.forEach(sch => {
    if (sch.lineName && sch.lineName.toLowerCase().includes(filter)) {
      shipNames.add(sch.lineName);
    }
  });
  shipNames = Array.from(shipNames);
  if (shipNames.length === 0) {
    document.getElementById("shipDropdownContainer").style.display = "none";
    return;
  }
  shipNames.forEach(ship => {
    const li = document.createElement("li");
    li.textContent = ship;
    li.style.padding = "4px";
    li.style.cursor = "pointer";
li.onclick = function() {
  showShipScheduleModal(ship);
  input.value = "";
  document.getElementById("shipDropdownContainer").style.display = "none";
};
    dropdown.appendChild(li);
  });
  document.getElementById("shipDropdownContainer").style.display = "block";
}

function showShipScheduleModal(shipName) {
  // 선택한 선박과 정확히 일치하는 스케쥴 필터링 (필요시 대소문자 구분 없이 처리 가능)
  const filteredSchedules = schedules.filter(sch => sch.lineName === shipName);
  const tbody = document.getElementById("shipScheduleListBody");
  tbody.innerHTML = "";
  if(filteredSchedules.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.textContent = "해당 선박의 스케쥴이 없습니다.";
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    filteredSchedules.forEach(sch => {
      const tr = document.createElement("tr");
      // Ship Name
      const tdShip = document.createElement("td");
      tdShip.textContent = sch.lineName || "";
      tr.appendChild(tdShip);
      // Hull No.
      const tdHull = document.createElement("td");
      tdHull.textContent = sch.hullNo || "";
      tr.appendChild(tdHull);
      // 엔지니어 (users에서 이름 조회)
      const tdEngineer = document.createElement("td");
      const engineer = (sch.userId && users[sch.userId]) ? users[sch.userId].id : "";
      tdEngineer.textContent = engineer;
      tr.appendChild(tdEngineer);
      // 본사 담당자
      const tdManager = document.createElement("td");
      const manager = (sch.managerId && users[sch.managerId]) ? users[sch.managerId].id : "";
      tdManager.textContent = manager;
      tr.appendChild(tdManager);
      // 시작일
      const tdStart = document.createElement("td");
      tdStart.textContent = sch.startDate || "";
      tr.appendChild(tdStart);
      // 종료일
      const tdEnd = document.createElement("td");
      tdEnd.textContent = sch.endDate || "";
      tr.appendChild(tdEnd);
      // 상태
      const tdStatus = document.createElement("td");
      if (sch.unavailable) {
        tdStatus.textContent = "서비스 불가";
      } else if (sch.status === "cancelled") {
        tdStatus.textContent = "일정 취소";
      } else if (sch.status === "completed") {
        tdStatus.textContent = "서비스 완료";
      } else if (sch.status === "finalized" || sch.status === "일정 변경 / 최종 확정" || sch.status === "일정 확정") {
        tdStatus.textContent = "일정 확정";
      } else if (sch.status === "일정 등록 대기") {
        tdStatus.textContent = "일정 등록 대기";
      } else if (sch.status === "일정 등록") {
        tdStatus.textContent = "일정 등록";
      } else if (sch.status === "일정 변경") {
        tdStatus.textContent = "일정 변경";
      } else {
        tdStatus.textContent = sch.status || "";
      }
      tr.appendChild(tdStatus);
      
      // 행을 클릭하면 선박 스케쥴 모달은 닫히고, 해당 스케쥴의 상세 모달이 열리도록 함
      tr.style.cursor = "pointer";
      tr.onclick = function() {
        closeShipScheduleModal();
        openModal(sch.id);
      };
      tbody.appendChild(tr);
    });
  }
  // 모달 표시
  document.getElementById("shipScheduleModal").style.display = "block";
}

function closeShipScheduleModal() {
  document.getElementById("shipScheduleModal").style.display = "none";
}




/****************************************
 12) 히스토리 기록
*****************************************/
function recordHistory(actionType, userUid, newSchedule, oldSchedule = null){
  const userName = users[userUid] ? users[userUid].id : userUid;
  const data = {
    action: actionType,
    user: userName,
    timestamp: new Date().toISOString(),
    oldStartDate: oldSchedule ? oldSchedule.startDate : "",
    oldEndDate: oldSchedule ? oldSchedule.endDate : "",
    newStartDate: newSchedule.startDate || "",
    newEndDate: newSchedule.endDate || "",
    // 변경 전 데이터
    oldIMO: oldSchedule ? oldSchedule.imoNo || "" : "",
    oldShipName: oldSchedule ? oldSchedule.lineName || "" : "",
    oldHull: oldSchedule ? oldSchedule.hullNo || "" : "",
    oldRegion: oldSchedule ? oldSchedule.regionName || "" : "",
    oldDetails: oldSchedule ? oldSchedule.details || "" : "",
    oldMessage: oldSchedule ? oldSchedule.message || "" : "",
    oldStatus: oldSchedule ? oldSchedule.status || "" : "",
    oldUnavailable: oldSchedule ? oldSchedule.unavailable || false : false,
    // 변경 후 데이터
    newIMO: newSchedule.imoNo || "",
    newShipName: newSchedule.lineName || "",
    newHull: newSchedule.hullNo || "",
    newRegion: newSchedule.regionName || "",
    newDetails: newSchedule.details || "",
    newMessage: newSchedule.message || "",
    newStatus: newSchedule.status || "",
    newUnavailable: newSchedule.unavailable || false,
    // 기존 정보 유지
    업체: (users[newSchedule.userId] ? users[newSchedule.userId].company : ""),
    엔지니어: (users[newSchedule.userId] ? users[newSchedule.userId].id : ""),
    ShipName: newSchedule.lineName || "",
    IMO: newSchedule.imoNo || "",
    Hull: newSchedule.hullNo || "",
    지역: newSchedule.regionName || "",
    담당자: newSchedule.managerId || ""
  };
  const newRef = db.ref("history").push();
  return newRef.set(data).then(() => { return enforceHistoryLimit(); });
}

function enforceHistoryLimit(){
  return db.ref("history").once("value").then(snap => {
    let arr = [];
    snap.forEach(child => { arr.push({ key: child.key, ...child.val() }); });
    arr.sort((a, b) => a.key.localeCompare(b.key));
    const exceed = arr.length - historyLimit;
    if(exceed > 0){
      let tasks = [];
      for(let i = 0; i < exceed; i++){ tasks.push(db.ref("history/" + arr[i].key).remove()); }
      return Promise.all(tasks);
    }
  });
}

/****************************************
 13) 일정 취소 / 최종 확정 / 서비스 완료
*****************************************/
function cancelSchedule(){
  if(!editingScheduleId) return;
  let reason = prompt("일정 취소 사유를 입력하세요:");
  if(!reason){ alert("취소 사유가 필요합니다."); return; }
  const idx = schedules.findIndex(x => x.id === editingScheduleId);
  if(idx < 0) return;
  if(!canAccessSchedule(schedules[idx])){ alert("권한 없음"); return; }
  const oldSch = { startDate: schedules[idx].startDate, endDate: schedules[idx].endDate };
  schedules[idx].cancelReason = reason;
  schedules[idx].status = "cancelled";
  db.ref("schedules").set(schedules).then(() => { return loadAllData(); })
  .then(() => {
    recordHistory("일정 취소", currentUid, schedules[idx], oldSch);
    alert("일정 취소 완료");
    if(confirm("이메일을 발송할까요?")){ sendEmailNotification(); }
    closeModal();
    refreshCalendar();
  });
}
function finalizeSchedule(){
  if(!editingScheduleId) return;
  if(!confirm("이 일정을 최종 확정하시겠습니까?")) return;
  const idx = schedules.findIndex(x => x.id === editingScheduleId);
  if(idx < 0) return;
  if(!canAccessSchedule(schedules[idx])){ alert("권한 없음"); return; }
  const oldSch = { startDate: schedules[idx].startDate, endDate: schedules[idx].endDate };
  schedules[idx].status = "finalized";
  db.ref("schedules").set(schedules).then(() => { return loadAllData(); })
  .then(() => {
    recordHistory("최종 확정", currentUid, schedules[idx], oldSch);
    alert("일정 최종 확정");
    if(confirm("이메일을 발송할까요?")){ sendEmailNotification(); }
    closeModal();
    refreshCalendar();
  });
}

// 서비스 완료 기능 추가
function completeService(){
  if(!editingScheduleId) return;
  if(!confirm("이 일정을 서비스 완료로 변경하시겠습니까?")) return;
  const idx = schedules.findIndex(x => x.id === editingScheduleId);
  if(idx < 0) return;
  if(!canAccessSchedule(schedules[idx])){ alert("권한 없음"); return; }
  const oldSch = { startDate: schedules[idx].startDate, endDate: schedules[idx].endDate };
  schedules[idx].status = "completed";
  db.ref("schedules").set(schedules).then(() => { return loadAllData(); })
  .then(() => {
    recordHistory("서비스 완료", currentUid, schedules[idx], oldSch);
    alert("서비스 완료 처리되었습니다.");
    if(confirm("이메일을 발송할까요?")){ sendEmailNotification(); }
    closeModal();
    refreshCalendar();
  });
}

/****************************************
 14) 일정 추가 / 변경 / 삭제
*****************************************/
// saveSchedule 함수 수정 (SHIPOWNER 필드 추가)
function saveSchedule(){
  const sDate = document.getElementById("modalStartDate").value;
  const eDate = document.getElementById("modalEndDate").value;
  const imoNo = document.getElementById("modalIMONo").value.trim();
  const shipOwner = document.getElementById("modalShipOwner").value.trim(); // SHIPOWNER 필드 추가
  const shipName = document.getElementById("modalLine").value.trim();
  const hullNo = document.getElementById("modalHullNo").value.trim();
  const regionVal = document.getElementById("modalRegion").value.trim();
  const workContent = document.getElementById("modalDetails").value.trim();
  const transferMsg = document.getElementById("modalMessage").value.trim();
  const isUnavailable = document.getElementById("modalUnavailable").checked;

  const asNoVal = document.getElementById("modalAsNo").value.trim();
  const asTypeVal = document.getElementById("modalAsType").value;
  
  // ETA, ETB, ETD 값 가져오기
  const etaVal = document.getElementById("modalETA").value;
  const etbVal = document.getElementById("modalETB").value;
  const etdVal = document.getElementById("modalETD").value;
  
  if(!sDate || !eDate){ alert("시작/종료일을 입력하세요"); return; }
  if(sDate > eDate){ alert("종료일이 시작일보다 빠릅니다."); return; }
  
  let mainUserId;
  if(document.getElementById("modalUserRow").style.display !== "none"){
    mainUserId = document.getElementById("modalUserSelect").value;
  } else if(editingScheduleId){
    const idxKeep = schedules.findIndex(x => x.id === editingScheduleId);
    mainUserId = idxKeep > -1 ? schedules[idxKeep].userId : currentUid;
  } else {
    mainUserId = currentUid;
  }
  const extraContainer = document.getElementById("additionalEngineerRows");
  const extraSelects = extraContainer.querySelectorAll("select");
  
  const managerId = isUnavailable ? 
    '' : // 서비스 불가인 경우 빈 값으로 처리
    document.getElementById("modalManagerSelect").value;
  
  if(editingScheduleId){
    var finalizeAnswer = confirm("일정변경 후에 최종 확정 할까요?");
    const idx = schedules.findIndex(x => x.id === editingScheduleId);
    if(idx > -1){
      if(!canAccessSchedule(schedules[idx])){ alert("수정 권한 없음"); return; }
      const oldSch = { ...schedules[idx] };
      schedules[idx].userId = mainUserId;
      schedules[idx].startDate = sDate;
      schedules[idx].endDate = eDate;
      schedules[idx].imoNo = imoNo;
      schedules[idx].shipOwner = shipOwner; // SHIPOWNER 필드 추가
      schedules[idx].lineName = shipName;
      schedules[idx].hullNo = hullNo;
      schedules[idx].regionName = regionVal;
      schedules[idx].details = workContent;
      schedules[idx].message = transferMsg;
      schedules[idx].unavailable = isUnavailable;
      schedules[idx].managerId = managerId; // 서비스 불가 여부에 따라 결정된 managerId 사용
      schedules[idx].asNo = asNoVal;
      schedules[idx].asType = asTypeVal;
      
      // ETA, ETB, ETD 추가
      schedules[idx].eta = etaVal;
      schedules[idx].etb = etbVal;
      schedules[idx].etd = etdVal;
      
      if(finalizeAnswer){
        schedules[idx].status = "일정 변경 / 최종 확정";
      } else {
        schedules[idx].status = "일정 변경";
      }
      extraSelects.forEach(sel => {
        const uid = sel.value;
        if(uid){
          const newId = Date.now() + Math.floor(Math.random() * 100000);
          schedules.push({
            id: newId,
            userId: uid,
            startDate: sDate,
            endDate: eDate,
            imoNo: imoNo,
            shipOwner: shipOwner, // SHIPOWNER 필드 추가
            lineName: shipName,
            hullNo: hullNo,
            regionName: regionVal,
            details: workContent,
            message: transferMsg,
            unavailable: isUnavailable,
            managerId: managerId, // 서비스 불가 여부에 따라 결정된 managerId 사용
            asNo: asNoVal,
            asType: asTypeVal,
            eta: etaVal,
            etb: etbVal,
            etd: etdVal,
            status: finalizeAnswer ? "일정 변경 / 최종 확정" : "일정 변경"
          });
        }
      });
      db.ref("schedules").set(schedules).then(() => { return loadAllData(); })
      .then(() => {
        recordHistory("일정 변경", currentUid, schedules[idx], oldSch);
        if(finalizeAnswer){
          alert("일정이 변경 및 최종 확정되었습니다.");
        } else {
          alert("일정이 변경되었습니다.");
        }
        if(confirm("이메일을 발송할까요?")){ sendEmailNotification(); }
        closeModal();
        refreshCalendar();
      });
    }
  } else {
    const newId = Date.now();
    const newSch = {
      id: newId,
      userId: mainUserId,
      startDate: sDate,
      endDate: eDate,
      imoNo: imoNo,
      shipOwner: shipOwner, // SHIPOWNER 필드 추가
      lineName: shipName,
      hullNo: hullNo,
      regionName: regionVal,
      details: workContent,
      message: transferMsg,
      unavailable: isUnavailable,
      managerId: managerId, // 서비스 불가 여부에 따라 결정된 managerId 사용
      asNo: asNoVal,
      asType: asTypeVal,
      eta: etaVal,
      etb: etbVal,
      etd: etdVal,
      status: "일정확정대기"
    };
    schedules.push(newSch);
    extraSelects.forEach(sel => {
      const uid = sel.value;
      if(uid){
        const newId2 = Date.now() + Math.floor(Math.random() * 100000);
        schedules.push({
          id: newId2,
          userId: uid,
          startDate: sDate,
          endDate: eDate,
          imoNo: imoNo,
          shipOwner: shipOwner, // SHIPOWNER 필드 추가
          lineName: shipName,
          hullNo: hullNo,
          regionName: regionVal,
          details: workContent,
          message: transferMsg,
          unavailable: isUnavailable,
          managerId: managerId, // 서비스 불가 여부에 따라 결정된 managerId 사용
          asNo: asNoVal,
          asType: asTypeVal,
          eta: etaVal,
          etb: etbVal,
          etd: etdVal,
          status: "일정확정대기"
        });
      }
    });
    db.ref("schedules").set(schedules).then(() => { return loadAllData(); })
    .then(() => {
      recordHistory("추가", currentUid, newSch);
      alert("새 일정이 추가되었습니다.");
      closeModal();
      refreshCalendar();
    });
  }
}
/****************************************
 15) 가용 엔지니어 계산 및 select 옵션 구축
*****************************************/
function updateAvailableEngineers(sDate, eDate){
  const listDiv = document.getElementById("availableEngineersList");
  if(!sDate || !eDate){
    listDiv.textContent = "시작/종료일을 먼저 입력하세요.";
    return;
  }
  let includeOther = false;
  const checkbox = document.getElementById("includeOtherPartnersCheckbox");
  if(checkbox) { includeOther = checkbox.checked; }
  const available = [];
  for(const uid in users){
    if(users[uid].role === "협력"){
      // 협력 사용자는 본인 회사의 협력자만 보임
      if(currentUser.role === "협력" && users[uid].company !== currentUser.company) continue;
      let subCategory = users[uid].subCategory || "기타";
      if(subCategory !== "주요" && !includeOther) continue;
      const conflict = schedules.some(sch => {
         if(sch.userId !== uid) return false;
         if(sch.status === "cancelled") return false;
         return (sch.startDate <= eDate && sch.endDate >= sDate);
      });
      if(!conflict) available.push(uid);
    }
  }
  if(available.length < 1){
    listDiv.textContent = "가용 엔지니어 없음";
  } else {
    listDiv.textContent = available.map(uid => users[uid].id + " (" + (users[uid].company || "업체 미지정") + ")").join(", ");
  }
}
function updateAssignedEngineers(sDate, eDate) {
  const listDiv = document.getElementById("assignedEngineersList");
  if (!sDate || !eDate) {
    listDiv.textContent = "시작/종료일을 먼저 입력하세요.";
    return;
  }
  let includeOther = false;
  const checkbox = document.getElementById("includeOtherPartnersCheckbox");
  if (checkbox) { includeOther = checkbox.checked; }
  
  const assigned = [];
  for (const uid in users) {
    if (users[uid].role === "협력") {
      // 협력 사용자의 경우, 자신의 회사에 속한 협력자만 보임
      if (currentUser.role === "협력" && users[uid].company !== currentUser.company) continue;
      let subCategory = users[uid].subCategory || "기타";
      // "주요" 협력사만 기본 표시, 체크박스가 체크되면 기타도 포함
      if (subCategory !== "주요" && !includeOther) continue;
      // 해당 기간에 이미 일정이 있는 경우
      const conflict = schedules.some(sch => {
        if (sch.userId !== uid) return false;
        if (sch.status === "cancelled") return false;
        return (sch.startDate <= eDate && sch.endDate >= sDate);
      });
      if (conflict) assigned.push(uid);
    }
  }
  if (assigned.length < 1) {
    listDiv.textContent = "배정 완료된 엔지니어 없음";
  } else {
    listDiv.textContent = assigned.map(uid => users[uid].id + " (" + (users[uid].company || "업체 미지정") + ")").join(", ");
  }
}

function buildEngineerSelectOptions(selectEl, selectedValue = null, filterCompany = null){
  selectEl.innerHTML = "";
  let engineerOptions = [];
  for(const uid in users){
    if(users[uid].role === "협력"){
      if(filterCompany && users[uid].company.trim().toLowerCase() !== filterCompany.trim().toLowerCase()) continue;
      engineerOptions.push({ uid: uid, name: users[uid].id || "NONAME", company: users[uid].company || "업체 미지정" });
    }
  }
  engineerOptions.sort((a, b) => a.company.localeCompare(b.company));
  engineerOptions.forEach(optData => {
    const opt = document.createElement("option");
    opt.value = optData.uid;
    opt.textContent = `${optData.name} (${optData.company})`;
    selectEl.appendChild(opt);
  });
  if(selectedValue){
    for(let i = 0; i < selectEl.options.length; i++){
      if(selectEl.options[i].value === selectedValue){ 
        selectEl.selectedIndex = i; 
        break; 
      }
    }
  }
}

function buildManagerSelectOptions(selectEl, selectedValue = null){
  selectEl.innerHTML = "";
  let hasOption = false;
  for(const uid in users){
    if(users[uid].role === "본사" || isAdminRole(users[uid].role)){
      const opt = document.createElement("option");
      opt.value = uid;
      opt.textContent = users[uid].id || "담당자";
      selectEl.appendChild(opt);
      hasOption = true;
    }
  }
  if(!hasOption){ selectEl.innerHTML = "<option value=''>없음</option>"; }
  if(selectedValue){
     for(let i = 0; i < selectEl.options.length; i++){
       if(selectEl.options[i].value === selectedValue){ selectEl.selectedIndex = i; break; }
     }
  }
}
function addEngineerRow(){
  const container = document.getElementById("additionalEngineerRows");
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.gap = "4px";
  row.style.marginTop = "4px";
  const newSelect = document.createElement("select");
  // 협력사 계정이면 자신의 회사에 속한 엔지니어만 표시
  if(currentUser.role === "협력"){
    buildEngineerSelectOptions(newSelect, null, currentUser.company);
  } else {
    buildEngineerSelectOptions(newSelect);
  }
  const removeBtn = document.createElement("button");
  removeBtn.textContent = "-";
  removeBtn.style.backgroundColor = "#c0392b";
  removeBtn.style.color = "#fff";
  removeBtn.onclick = () => { container.removeChild(row); };
  row.appendChild(newSelect);
  row.appendChild(removeBtn);
  container.insertBefore(row, container.firstChild);
}

/****************************************
 16) 관리자 페이지: 유저 목록, 수정, 등록, 스케줄 목록, 업체 색상 관리, 히스토리
*****************************************/
function showAdminPane(pane){
  // 모든 관리자 전용 판을 숨김
  document.getElementById("adminUserListPane").classList.remove("active");
  document.getElementById("adminUserRegisterPane").classList.remove("active");
  document.getElementById("adminScheduleListPane").classList.remove("active");
  document.getElementById("adminCompanyColorPane").classList.remove("active");
  document.getElementById("adminHistoryPane").classList.remove("active");
  document.getElementById("adminAccessHistoryPane").classList.remove("active");
  
  if(pane === "userList"){
    document.getElementById("adminUserListPane").classList.add("active");
    populateUserCompanyFilter(); // 업체별 필터 옵션 채우기 추가
    drawUserList();
  } else if(pane === "userRegister"){
    document.getElementById("adminUserRegisterPane").classList.add("active");
  } else if(pane === "scheduleList"){
    document.getElementById("adminScheduleListPane").classList.add("active");
    setDefaultScheduleQueryDates(); // 기본 날짜 설정 추가
    drawScheduleList();
  } else if(pane === "companyColor"){
    document.getElementById("adminCompanyColorPane").classList.add("active");
    drawCompanyColorList();
  } else if(pane === "history"){
    db.ref("history").once("value").then(snap => {
      let temp = [];
      snap.forEach(child => { temp.push({ key: child.key, ...child.val() }); });
      histories = temp;
      drawHistoryList();
      document.getElementById("adminHistoryPane").classList.add("active");
    });
  } else if(pane === "accessHistory"){
    document.getElementById("adminAccessHistoryPane").classList.add("active");
    setDefaultAccessHistoryDates(); // 날짜 기본값 설정
    drawAccessHistory();
  }
}

function drawAccessHistory() {
  const tbody = document.getElementById("adminAccessHistoryBody");
  tbody.innerHTML = "";
  
  // 로딩 메시지 표시
  const loadingRow = document.createElement("tr");
  loadingRow.innerHTML = '<td colspan="6" style="text-align:center;">데이터 로딩 중...</td>';
  tbody.appendChild(loadingRow);
  
  // 기간 설정 가져오기
  const startDate = document.getElementById("accessHistoryStartDate").value;
  const endDate = document.getElementById("accessHistoryEndDate").value;
  
  // 시작일과 종료일이 모두 설정되지 않았다면 기본값 설정
  if (!startDate || !endDate) {
    // 기본 기간: 현재부터 30일 전
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const formattedToday = formatDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
    const formattedThirtyDaysAgo = formatDate(thirtyDaysAgo.getFullYear(), thirtyDaysAgo.getMonth() + 1, thirtyDaysAgo.getDate());
    
    document.getElementById("accessHistoryStartDate").value = formattedThirtyDaysAgo;
    document.getElementById("accessHistoryEndDate").value = formattedToday;
  }
  
  db.ref("accessHistory").once("value").then(snap => {
    tbody.innerHTML = ""; // 로딩 메시지 제거
    
    if (!snap.exists()) {
      const emptyRow = document.createElement("tr");
      emptyRow.innerHTML = '<td colspan="6" style="text-align:center;">접속 기록이 없습니다.</td>';
      tbody.appendChild(emptyRow);
      return;
    }
    
    // 기간 필터링을 위한 시작/종료일 시간값 설정
    const startTime = document.getElementById("accessHistoryStartDate").value + "T00:00:00.000Z";
    const endTime = document.getElementById("accessHistoryEndDate").value + "T23:59:59.999Z";
    
    // 사용자별 접속 기록 집계
    const userAccessCount = {};
    const userLastAccess = {};
    
    snap.forEach(child => {
      const data = child.val();
      const timestamp = data.timestamp || "";
      const userId = data.userId || "";
      
      // 기간 내 기록만 필터링
      if (timestamp && userId && timestamp >= startTime && timestamp <= endTime) {
        if (!userAccessCount[userId]) {
          userAccessCount[userId] = 0;
          userLastAccess[userId] = "";
        }
        
        userAccessCount[userId]++;
        
        // 마지막 접속 시간 업데이트
        if (!userLastAccess[userId] || timestamp > userLastAccess[userId]) {
          userLastAccess[userId] = timestamp;
        }
      }
    });
    
    // 접속 횟수가 있는 사용자만 테이블에 표시
    let hasRecords = false;
    
    // 각 사용자 정보 및 접속 횟수 표시
    for (const uid in users) {
      if (userAccessCount[uid]) {
        hasRecords = true;
        const user = users[uid];
        const tr = document.createElement("tr");
        
        const tdName = document.createElement("td");
        tdName.textContent = user.id || "(이름 없음)";
        
        const tdEmail = document.createElement("td");
        tdEmail.textContent = user.email || "";
        
        const tdRole = document.createElement("td");
        tdRole.textContent = user.role || "";
        
        const tdCompany = document.createElement("td");
        tdCompany.textContent = user.company || "";
        
        const tdCount = document.createElement("td");
        tdCount.textContent = userAccessCount[uid] || 0;
        
        const tdLastAccess = document.createElement("td");
// 시간 표시 부분
if (userLastAccess[uid]) {
  // UTC 시간을 한국 시간으로 변환 (9시간 추가)
  const utcDate = new Date(userLastAccess[uid]);
  const kstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
  tdLastAccess.textContent = kstDate.toISOString().replace("T", " ").substring(0, 19);
} else {
  tdLastAccess.textContent = "-";
}
        
        tr.appendChild(tdName);
        tr.appendChild(tdEmail);
        tr.appendChild(tdRole);
        tr.appendChild(tdCompany);
        tr.appendChild(tdCount);
        tr.appendChild(tdLastAccess);
        
        tbody.appendChild(tr);
      }
    }
    
    // 접속 기록이 없는 경우 메시지 표시
    if (!hasRecords) {
      const emptyRow = document.createElement("tr");
      emptyRow.innerHTML = '<td colspan="6" style="text-align:center;">선택한 기간에 접속 기록이 없습니다.</td>';
      tbody.appendChild(emptyRow);
    }
  }).catch(err => {
    tbody.innerHTML = "";
    const errorRow = document.createElement("tr");
    errorRow.innerHTML = `<td colspan="6" style="text-align:center; color:red;">데이터 로드 오류: ${err.message}</td>`;
    tbody.appendChild(errorRow);
  });
}
function deleteAdminSchedule(sid){
  if(!confirm("스케줄 삭제?")) return;
  const idx = schedules.findIndex(x => x.id === sid);
  if(idx < 0) return;
  const delObj = schedules[idx];
  schedules.splice(idx, 1);
  db.ref("schedules").set(schedules).then(() => { return loadAllData(); })
  .then(() => {
    recordHistory("삭제", currentUid, delObj);
    alert("삭제 완료");
    drawScheduleList();
    refreshCalendar();
  });
}

/****************************************
 17) 업체 색상 관리
*****************************************/
/* 업체 색상 관리 테이블 그리기 */
function drawCompanyColorList(){
  const tbody = document.getElementById("companyColorBody");
  tbody.innerHTML = "";

  // 업체명 셀렉트 박스 갱신
  const sel = document.getElementById("selectCompanyName");
  sel.innerHTML = "";

  let compSet = {};
  // users에 있는 모든 company, companyColors에 등록된 모든 company 수집
  for(const uid in users){
    compSet[ users[uid].company || "기타" ] = true;
  }
  for(const cName in companyColors){
    compSet[cName] = true;
  }

  // selectCompanyName에 옵션 추가
  for(const cName in compSet){
    const opt = document.createElement("option");
    opt.value = cName;
    opt.textContent = cName;
    sel.appendChild(opt);
  }

  // 업체별 색상 목록 테이블
  for(const cName in companyColors){
    const cVal = companyColors[cName];
    const tr = document.createElement("tr");

    // 1) 업체명
    const tdName = document.createElement("td");
    tdName.textContent = cName;
    tr.appendChild(tdName);

    // 2) 기본(normal)
    const tdNormal = document.createElement("td");
    const divN = document.createElement("div");
    divN.style.width = "30px"; 
    divN.style.height = "15px"; 
    divN.style.margin = "0 auto";
    divN.style.background = cVal.normal || "#999";
    tdNormal.appendChild(divN);
    tr.appendChild(tdNormal);

    // 3) 취소(cancel)
    const tdCancel = document.createElement("td");
    const divC = document.createElement("div");
    divC.style.width = "30px"; 
    divC.style.height = "15px"; 
    divC.style.margin = "0 auto";
    divC.style.background = cVal.cancel || "#f00";
    tdCancel.appendChild(divC);
    tr.appendChild(tdCancel);

    // 4) 확정(final)
    const tdFinal = document.createElement("td");
    const divF = document.createElement("div");
    divF.style.width = "30px"; 
    divF.style.height = "15px"; 
    divF.style.margin = "0 auto";
    divF.style.background = cVal.final || "#0f0";
    tdFinal.appendChild(divF);
    tr.appendChild(tdFinal);

    // 5) 불가(unavailable)
    const tdUnavail = document.createElement("td");
    const divU = document.createElement("div");
    divU.style.width = "30px";
    divU.style.height = "15px";
    divU.style.margin = "0 auto";
    divU.style.background = cVal.unavailable || "#ccc";
    tdUnavail.appendChild(divU);
    tr.appendChild(tdUnavail);
    
    // 6) 완료(completed) 추가
    const tdCompleted = document.createElement("td");
    const divComp = document.createElement("div");
    divComp.style.width = "30px";
    divComp.style.height = "15px";
    divComp.style.margin = "0 auto";
    divComp.style.background = cVal.completed || "#3498db";
    tdCompleted.appendChild(divComp);
    tr.appendChild(tdCompleted);

    // 7) 삭제 버튼
    const tdDel = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "admin-btn";
    delBtn.textContent = "삭제";
    delBtn.onclick = () => deleteCompanyColor(cName);
    tdDel.appendChild(delBtn);
    tr.appendChild(tdDel);

    tbody.appendChild(tr);
  }
}

/* select 박스에서 업체 선택 시, 기존 색상 불러오기 */
function onSelectCompanyNameChange(){
  const cName = document.getElementById("selectCompanyName").value;
  if(!cName) return;
  const rec = companyColors[cName];
  if(rec){
    document.getElementById("inputCompanyColorNormal").value      = rec.normal      || "#999999";
    document.getElementById("inputCompanyColorCancel").value      = rec.cancel      || "#ff0000";
    document.getElementById("inputCompanyColorFinal").value       = rec.final       || "#00ff00";
    document.getElementById("inputCompanyColorUnavailable").value = rec.unavailable || "#cccccc";
    document.getElementById("inputCompanyColorCompleted").value  = rec.completed   || "#3498db";
  } else {
    // 새 업체면 기본값 세팅
    document.getElementById("inputCompanyColorNormal").value      = "#999999";
    document.getElementById("inputCompanyColorCancel").value      = "#ff0000";
    document.getElementById("inputCompanyColorFinal").value       = "#00ff00";
    document.getElementById("inputCompanyColorUnavailable").value = "#cccccc";
    document.getElementById("inputCompanyColorCompleted").value  = "#3498db";
  }
}

/* 업체 색상 추가/수정 */
function saveCompanyColor(){
  const name = document.getElementById("selectCompanyName").value.trim();
  if(!name){ 
    alert("업체명을 선택하세요");
    return;
  }
  const nCol = document.getElementById("inputCompanyColorNormal").value.trim()      || "#999999";
  const cCol = document.getElementById("inputCompanyColorCancel").value.trim()      || "#ff0000";
  const fCol = document.getElementById("inputCompanyColorFinal").value.trim()       || "#00ff00";
  const uCol = document.getElementById("inputCompanyColorUnavailable").value.trim() || "#cccccc";
  const compCol = document.getElementById("inputCompanyColorCompleted").value.trim() || "#3498db";

  companyColors[name] = {
    normal: nCol,
    cancel: cCol,
    final: fCol,
    unavailable: uCol,
    completed: compCol
  };

  db.ref("companyColors").set(companyColors)
    .then(() => {
      alert("업체 색상 저장 완료");
      // 저장 후 기본값 리셋
      document.getElementById("inputCompanyColorNormal").value      = "#999999";
      document.getElementById("inputCompanyColorCancel").value      = "#ff0000";
      document.getElementById("inputCompanyColorFinal").value       = "#00ff00";
      document.getElementById("inputCompanyColorUnavailable").value = "#cccccc";
      document.getElementById("inputCompanyColorCompleted").value   = "#3498db";
      // 테이블 다시 그리기
      loadAllData().then(() => drawCompanyColorList());
    });
}

/* 업체 색상 삭제 */
function deleteCompanyColor(cName){
  if(!confirm(cName + " 색상정보를 삭제하시겠습니까?")) return;
  delete companyColors[cName];
  db.ref("companyColors").set(companyColors)
    .then(() => {
      alert("삭제 완료");
      loadAllData().then(() => drawCompanyColorList());
    });
}

/****************************************
 18) 엑셀 업/다운로드 (스케줄 목록)
*****************************************/
function excelSerialToJSDate(serial) {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const daysAfter = serial - 1; 
  return new Date(excelEpoch.getTime() + daysAfter * 86400000);
}
function formatExcelDateToYyyyMmDd(value) {
  if (typeof value === "number") {
    const jsDate = excelSerialToJSDate(value);
    return jsDate.toISOString().substring(0, 10); 
  } else if (typeof value === "string") {
    return value.substring(0, 10);
  } else {
    return "";
  }
}
// saveSchedule 함수 수정 (SHIPOWNER 필드 추가)
function saveSchedule(){
  const sDate = document.getElementById("modalStartDate").value;
  const eDate = document.getElementById("modalEndDate").value;
  const imoNo = document.getElementById("modalIMONo").value.trim();
  const shipOwner = document.getElementById("modalShipOwner").value.trim(); // SHIPOWNER 필드 추가
  const shipName = document.getElementById("modalLine").value.trim();
  const hullNo = document.getElementById("modalHullNo").value.trim();
  const regionVal = document.getElementById("modalRegion").value.trim();
  const workContent = document.getElementById("modalDetails").value.trim();
  const transferMsg = document.getElementById("modalMessage").value.trim();
  const isUnavailable = document.getElementById("modalUnavailable").checked;
  
  // ETA, ETB, ETD 값 가져오기
  const etaVal = document.getElementById("modalETA").value;
  const etbVal = document.getElementById("modalETB").value;
  const etdVal = document.getElementById("modalETD").value;
  
  if(!sDate || !eDate){ alert("시작/종료일을 입력하세요"); return; }
  if(sDate > eDate){ alert("종료일이 시작일보다 빠릅니다."); return; }
  
  let mainUserId;
  if(document.getElementById("modalUserRow").style.display !== "none"){
    mainUserId = document.getElementById("modalUserSelect").value;
  } else if(editingScheduleId){
    const idxKeep = schedules.findIndex(x => x.id === editingScheduleId);
    mainUserId = idxKeep > -1 ? schedules[idxKeep].userId : currentUid;
  } else {
    mainUserId = currentUid;
  }
  const extraContainer = document.getElementById("additionalEngineerRows");
  const extraSelects = extraContainer.querySelectorAll("select");
  
  const managerId = isUnavailable ? 
    '' : // 서비스 불가인 경우 빈 값으로 처리
    document.getElementById("modalManagerSelect").value;
  
  if(editingScheduleId){
    var finalizeAnswer = confirm("일정변경 후에 최종 확정 할까요?");
    const idx = schedules.findIndex(x => x.id === editingScheduleId);
    if(idx > -1){
      if(!canAccessSchedule(schedules[idx])){ alert("수정 권한 없음"); return; }
      const oldSch = { ...schedules[idx] };
      schedules[idx].userId = mainUserId;
      schedules[idx].startDate = sDate;
      schedules[idx].endDate = eDate;
      schedules[idx].imoNo = imoNo;
      schedules[idx].shipOwner = shipOwner; // SHIPOWNER 필드 추가
      schedules[idx].lineName = shipName;
      schedules[idx].hullNo = hullNo;
      schedules[idx].regionName = regionVal;
      schedules[idx].details = workContent;
      schedules[idx].message = transferMsg;
      schedules[idx].unavailable = isUnavailable;
      schedules[idx].managerId = managerId; // 서비스 불가 여부에 따라 결정된 managerId 사용
      
      // ETA, ETB, ETD 추가
      schedules[idx].eta = etaVal;
      schedules[idx].etb = etbVal;
      schedules[idx].etd = etdVal;
      
      if(finalizeAnswer){
        schedules[idx].status = "일정 변경 / 최종 확정";
      } else {
        schedules[idx].status = "일정 변경";
      }
      extraSelects.forEach(sel => {
        const uid = sel.value;
        if(uid){
          const newId = Date.now() + Math.floor(Math.random() * 100000);
          schedules.push({
            id: newId,
            userId: uid,
            startDate: sDate,
            endDate: eDate,
            imoNo: imoNo,
            shipOwner: shipOwner, // SHIPOWNER 필드 추가
            lineName: shipName,
            hullNo: hullNo,
            regionName: regionVal,
            details: workContent,
            message: transferMsg,
            unavailable: isUnavailable,
            managerId: managerId, // 서비스 불가 여부에 따라 결정된 managerId 사용
            eta: etaVal,
            etb: etbVal,
            etd: etdVal,
            status: finalizeAnswer ? "일정 변경 / 최종 확정" : "일정 변경"
          });
        }
      });
      db.ref("schedules").set(schedules).then(() => { return loadAllData(); })
      .then(() => {
        recordHistory("일정 변경", currentUid, schedules[idx], oldSch);
        if(finalizeAnswer){
          alert("일정이 변경 및 최종 확정되었습니다.");
        } else {
          alert("일정이 변경되었습니다.");
        }
        if(confirm("이메일을 발송할까요?")){ sendEmailNotification(); }
        closeModal();
        refreshCalendar();
      });
    }
  } else {
    const newId = Date.now();
    const newSch = {
      id: newId,
      userId: mainUserId,
      startDate: sDate,
      endDate: eDate,
      imoNo: imoNo,
      shipOwner: shipOwner, // SHIPOWNER 필드 추가
      lineName: shipName,
      hullNo: hullNo,
      regionName: regionVal,
      details: workContent,
      message: transferMsg,
      unavailable: isUnavailable,
      managerId: managerId, // 서비스 불가 여부에 따라 결정된 managerId 사용
      eta: etaVal,
      etb: etbVal,
      etd: etdVal,
      status: "일정확정대기"
    };
    schedules.push(newSch);
    extraSelects.forEach(sel => {
      const uid = sel.value;
      if(uid){
        const newId2 = Date.now() + Math.floor(Math.random() * 100000);
        schedules.push({
          id: newId2,
          userId: uid,
          startDate: sDate,
          endDate: eDate,
          imoNo: imoNo,
          shipOwner: shipOwner, // SHIPOWNER 필드 추가
          lineName: shipName,
          hullNo: hullNo,
          regionName: regionVal,
          details: workContent,
          message: transferMsg,
          unavailable: isUnavailable,
          managerId: managerId, // 서비스 불가 여부에 따라 결정된 managerId 사용
          eta: etaVal,
          etb: etbVal,
          etd: etdVal,
          status: "일정확정대기"
        });
      }
    });
    db.ref("schedules").set(schedules).then(() => { return loadAllData(); })
    .then(() => {
      recordHistory("추가", currentUid, newSch);
      alert("새 일정이 추가되었습니다.");
      closeModal();
      refreshCalendar();
    });
  }
}

// 엑셀 다운로드 함수 (수정)
function downloadExcel() {
  // 내부 상태를 한글로 매핑하는 객체
  const statusToKorean = {
    "cancelled": "일정 취소",
    "finalized": "일정 확정",
    "completed": "서비스 완료",
    "일정 등록 대기": "일정 등록 대기",
    "일정 등록": "일정 등록",
    "일정 변경": "일정 변경",
    "서비스 불가": "서비스 불가"
  };

  // 조회 기간 필터 적용 (상태 페이지의 기간 필터 활용)
  let exportSchedules = schedules;
  const qs = document.getElementById("statusQueryStart");
  const qe = document.getElementById("statusQueryEnd");
  if(qs && qe){
    const startVal = qs.value;
    const endVal = qe.value;
    if(startVal || endVal){
      exportSchedules = schedules.filter(sch =>
        (!startVal || sch.startDate >= startVal) &&
        (!endVal || sch.startDate <= endVal)
      );
    }
  }

  // exportData 생성 – 헤더를 한글로 지정
  const exportData = exportSchedules.map(sch => {
    const managerName =
      sch.managerId && users[sch.managerId] ? users[sch.managerId].id : "";
    const engineerName =
      sch.userId && users[sch.userId] ? users[sch.userId].id : "";
    const company =
      sch.userId && users[sch.userId] ? users[sch.userId].company : "";
    
    // 상태 표시
    let displayStatus = "";
    if (sch.unavailable) {
      displayStatus = "서비스 불가";
    } else if (sch.status === "cancelled") {
      displayStatus = "일정 취소";
    } else if (sch.status === "completed") {
      displayStatus = "서비스 완료";
    } else if (
      sch.status === "finalized" ||
      sch.status === "일정 변경 / 최종 확정" ||
      sch.status === "일정 확정"
    ) {
      displayStatus = "일정 확정";
    } else if (sch.status === "일정 등록 대기") {
      displayStatus = "일정 등록 대기";
    } else if (sch.status === "일정 등록") {
      displayStatus = "일정 등록";
    } else if (sch.status === "일정 변경") {
      displayStatus = "일정 변경";
    } else {
      displayStatus = sch.status || "";
    }
    
    // 방선일 계산
    let departureDate = sch.departureDate || "";
    if (!departureDate && sch.endDate) {
      const endDate = new Date(sch.endDate);
      if (!isNaN(endDate.getTime())) {
        endDate.setDate(endDate.getDate() + 1);
        departureDate = endDate.toISOString().substring(0, 10);
      }
    }
    
    return {
      "ETA": sch.eta || "",
      "ETB": sch.etb || "",
      "ETD": sch.etd || "",
      "지역": sch.regionName || "",
      "국가": sch.country || "",
      "IMO 번호": sch.imoNo || "",
      "SHIPOWNER": sch.shipOwner || "",
      "HULL 번호": sch.hullNo || "",
      "SHIP NAME": sch.lineName || "",
      "담당자": managerName,
      "업체": company,
      "엔지니어": engineerName,
      "AS NO.": sch.asNo || "",
      "AS 구분": sch.asType || "",
      "시작일": sch.startDate || "",
      "종료일": sch.endDate || "",
      "방선일": departureDate,
      "취소 사유": sch.cancelReason || "",
      "상태": displayStatus,
      "상세": sch.details || "",
      "전달사항": sch.message || "",
      "서비스 불가": sch.unavailable ? "네" : "아니오"
    };
  });

  // 워크시트와 워크북 생성
  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "스케줄");

  // --- 데이터 유효성 검사(드롭다운) 추가 ---
  // 고정 목록: 상태, 서비스 불가, AS 구분
  const statusList = "일정 등록 대기,일정 등록,일정 변경,일정 취소,일정 확정,서비스 완료,서비스 불가";
  const unavailableList = "네,아니오";
  const asTypeList = "유상,무상,위탁";

  // 엔지니어 목록: users 중 협력 계정의 이름 (중복 제거)
  let engineerOptions = [];
  for (const uid in users) {
    if (users[uid].role === "협력") {
      engineerOptions.push(users[uid].id);
    }
  }
  const engineerList = Array.from(new Set(engineerOptions)).join(",");

  // 본사 담당자 목록: users 중 본사 또는 관리자 계정의 이름 (중복 제거)
  let managerOptions = [];
  for (const uid in users) {
    if (users[uid].role === "본사" || isAdminRole(users[uid].role)) {
      managerOptions.push(users[uid].id);
    }
  }
  const hqManagerList = Array.from(new Set(managerOptions)).join(",");

  // 데이터 유효성 검사 적용: 헤더는 1행에 있으므로 데이터는 2행부터 (예: 2행 ~ 1000행)
  ws["!dataValidation"] = [
    // 상태 열
    {
      sqref: "R2:R1000", 
      type: "list",
      formula1: "\"" + statusList + "\""
    },
    // 서비스 불가 열
    {
      sqref: "U2:U1000", 
      type: "list",
      formula1: "\"" + unavailableList + "\""
    },
    // AS 구분 열
    {
      sqref: "M2:M1000", 
      type: "list",
      formula1: "\"" + asTypeList + "\""
    }
  ];
  // --- 끝 ---

  XLSX.writeFile(wb, "스케줄_템플릿.xlsx");
}


// 초기화 시 호출할 함수
// 테이블 초기화 함수 개선
function initializeScheduleTable() {
  // 스케줄 목록 페이지 초기화
  const table = document.getElementById('editableScheduleTable');
  if (!table) return; // 테이블이 아직 로드되지 않은 경우
  
  // 테이블 레이아웃 로드
  loadTableLayout().then(() => {
    // 컬럼 리사이징 설정
    setupTableResizing();
    
    // ESC 키로 전체화면 모드 종료
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && fullscreenMode) {
        toggleFullscreenTable();
      }
    });
  });
}

// 페이지 로드 완료 후 실행
window.addEventListener('DOMContentLoaded', function() {
  // 필요한 초기화 함수 호출
  setTimeout(initializeScheduleTable, 1000); // 1초 후 초기화 (DOM이 완전히 로드된 후)
});

// 엑셀 업로드 함수 수정
function uploadExcel(event){
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: "array" });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(ws, { raw: true });
    
    // 한글 상태를 내부 상태로 매핑
    const koreanToStatus = {
      "일정 취소": "cancelled",
      "일정 확정": "finalized", 
      "일정 변경 / 최종 확정": "일정 변경 / 최종 확정",
      "일정 등록 대기": "일정 등록 대기",
      "서비스 완료": "completed",
      "정상": "normal"
    };
    
    const newArr = jsonData.map(row => {
      // 담당자(manager) 찾기
      let managerUid = "";
      if (row["담당자"]) {
        for (const uid in users) {
          if ((users[uid].role === "본사" || isAdminRole(users[uid].role)) && users[uid].id === row["담당자"]) {
            managerUid = uid;
            break;
          }
        }
      }
      
      // 엔지니어 찾기
      let engineerUid = "";
      if (row["엔지니어"]) {
        for (const uid in users) {
          if (users[uid].role === "협력" && users[uid].id === row["엔지니어"]) {
            engineerUid = uid;
            break;
          }
        }
      }
      
      // 날짜 파싱
      const start = parseExcelDate(row["시작일"]);
      const end = parseExcelDate(row["종료일"]);
      const eta = parseExcelDate(row["ETA"]);
      const etb = parseExcelDate(row["ETB"]);
      const etd = parseExcelDate(row["ETD"]);
      const departureDate = parseExcelDate(row["방선일"]);
      
      // 서비스 불가 여부
      const unavailableBool = (row["서비스 불가"] === "네");
      
      // 상태 변환
      const statusInternal = koreanToStatus[row["상태"]] || row["상태"] || "normal";
      
      return {
        id: Date.now() + Math.floor(Math.random() * 100000),
        startDate: start,
        endDate: end,
        eta: eta,
        etb: etb,
        etd: etd,
        lineName: row["SHIP NAME"] || "",
        imoNo: row["IMO 번호"] || "",
        hullNo: row["HULL 번호"] || "",
        regionName: row["지역"] || "",
        country: row["국가"] || "",
        details: row["상세"] || "",
        message: row["전달사항"] || "",
        status: statusInternal,
        userId: engineerUid,
        unavailable: unavailableBool,
        managerId: managerUid,
        cancelReason: row["취소 사유"] || "",
        departureDate: departureDate,
        asNo: row["AS NO."] || "",
        asType: row["AS 구분"] || ""
      };
    });
    
    schedules = newArr;
    db.ref("schedules").set(schedules)
      .then(() => {
        alert("엑셀 업로드 완료");
        drawScheduleList();
        refreshCalendar();
      })
      .catch(err => {
        console.error("업로드 에러:", err);
        alert("업로드 실패: " + err.message);
      });
  };
  reader.readAsArrayBuffer(file);
}
/****************************************
 19) 변경 히스토리 및 히스토리 엑셀 다운로드
*****************************************/
function drawHistoryList(){
  document.getElementById("historyLimitInput").value = historyLimit;
  const tbody = document.getElementById("adminHistoryBody");
  tbody.innerHTML = "";
  
  // 컨테이너에 좌우 스크롤 적용
  const container = document.getElementById("adminHistoryPane");
  container.style.overflowX = "auto";
  
  const table = tbody.closest('table');
  table.style.minWidth = "1200px"; // 최소 너비 설정
  
  const sorted = [...histories].sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  sorted.forEach(h => {
    const tr = document.createElement("tr");
    
    // 1. 시간 정보
    const tdTime = document.createElement("td");
    tdTime.style.width = "80px";
    tdTime.textContent = (h.timestamp || "").replace("T", " ").substring(0,19);
    tr.appendChild(tdTime);
    
    // 2. 사용자 정보
    const tdUser = document.createElement("td");
    tdUser.textContent = h.user || "";
    tr.appendChild(tdUser);
    
    // 3. 변경 전 시작일/종료일
    const tdOldStart = document.createElement("td");
    tdOldStart.textContent = h.oldStartDate || "";
    tr.appendChild(tdOldStart);
    
    const tdOldEnd = document.createElement("td");
    tdOldEnd.textContent = h.oldEndDate || "";
    tr.appendChild(tdOldEnd);
    
    // 4. 변경 후 시작일/종료일
    const tdNewStart = document.createElement("td");
    tdNewStart.textContent = h.newStartDate || "";
    tr.appendChild(tdNewStart);
    
    const tdNewEnd = document.createElement("td");
    tdNewEnd.textContent = h.newEndDate || "";
    tr.appendChild(tdNewEnd);
    
    // 5. 구분
    const tdAct = document.createElement("td");
    tdAct.textContent = h.action || "";
    tr.appendChild(tdAct);
    
    // 6. 추가 데이터들 (IMO, Ship Name, Hull No, 지역, 상세 등)
    // 업체
    const tdCompany = document.createElement("td");
    tdCompany.textContent = h.업체 || "";
    tr.appendChild(tdCompany);
    
    // 엔지니어
    const tdEngineer = document.createElement("td");
    tdEngineer.textContent = h.엔지니어 || "";
    tr.appendChild(tdEngineer);
    
    // Ship Name (변경 전/후)
    const tdOldShipName = document.createElement("td");
    tdOldShipName.textContent = h.oldShipName || "";
    tr.appendChild(tdOldShipName);
    
    const tdNewShipName = document.createElement("td");
    tdNewShipName.textContent = h.newShipName || "";
    tr.appendChild(tdNewShipName);
    
    // IMO No (변경 전/후)
    const tdOldIMO = document.createElement("td");
    tdOldIMO.textContent = h.oldIMO || "";
    tr.appendChild(tdOldIMO);
    
    const tdNewIMO = document.createElement("td");
    tdNewIMO.textContent = h.newIMO || "";
    tr.appendChild(tdNewIMO);
    
    // Hull No (변경 전/후)
    const tdOldHull = document.createElement("td");
    tdOldHull.textContent = h.oldHull || "";
    tr.appendChild(tdOldHull);
    
    const tdNewHull = document.createElement("td");
    tdNewHull.textContent = h.newHull || "";
    tr.appendChild(tdNewHull);
    
    // 지역 (변경 전/후)
    const tdOldRegion = document.createElement("td");
    tdOldRegion.textContent = h.oldRegion || "";
    tr.appendChild(tdOldRegion);
    
    const tdNewRegion = document.createElement("td");
    tdNewRegion.textContent = h.newRegion || "";
    tr.appendChild(tdNewRegion);
    
    // 담당자
    const tdManager = document.createElement("td");
    tdManager.textContent = h.담당자 || "";
    tr.appendChild(tdManager);
    
    tbody.appendChild(tr);
  });
}

function setHistoryLimit(){
  const val = parseInt(document.getElementById("historyLimitInput").value, 10);
  if(isNaN(val) || val < 1){ alert("1 이상의 숫자를 입력하세요."); return; }
  historyLimit = val;
  db.ref("historyLimit").set(val).then(() => {
    alert("히스토리 최대 개수 설정 완료");
    enforceHistoryLimit();
  });
}

function downloadHistoryExcel(){
  const histData = histories.map(h => ({
      time: (h.timestamp || "").replace("T", " ").substring(0,19),
      user: h.user || "",
      oldStartDate: h.oldStartDate || "",
      oldEndDate: h.oldEndDate || "",
      newStartDate: h.newStartDate || "",
      newEndDate: h.newEndDate || "",
      action: h.action || "",
      업체: h.업체 || "",
      엔지니어: h.엔지니어 || "",
      변경전_Ship_Name: h.oldShipName || "",
      변경후_Ship_Name: h.newShipName || "",
      변경전_IMO_No: h.oldIMO || "",
      변경후_IMO_No: h.newIMO || "",
      변경전_Hull_No: h.oldHull || "",
      변경후_Hull_No: h.newHull || "",
      변경전_지역: h.oldRegion || "",
      변경후_지역: h.newRegion || "",
      담당자: h.담당자 || ""
  }));
  const ws = XLSX.utils.json_to_sheet(histData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Histories");
  XLSX.writeFile(wb, "histories.xlsx");
}
function drawUserList() {
  // 사용자 목록 컨테이너 가져오기
  const tbody = document.getElementById("adminUserListBody");
  tbody.innerHTML = "";
  
  // 업체별 필터 적용
  const filterCompany = document.getElementById("userCompanyFilter").value;
  
  // 사용자 배열 생성 및 정렬 (업체명 기준)
  let userArray = [];
  for (const uid in users) {
    userArray.push({ uid: uid, user: users[uid] });
  }
  userArray.sort((a, b) => {
    let compA = a.user.company ? a.user.company.toLowerCase() : "";
    let compB = b.user.company ? b.user.company.toLowerCase() : "";
    return compA.localeCompare(compB);
  });
  
  // 사용자 목록 표시
  userArray.forEach(item => {
    // 업체별 필터 적용
    if (filterCompany && item.user.company !== filterCompany) return;
    
    const tr = document.createElement("tr");
    
    // 이름
    const tdName = document.createElement("td");
    tdName.textContent = item.user.id || "(이름 없음)";
    tr.appendChild(tdName);
    
    // 이메일
    const tdEmail = document.createElement("td");
    tdEmail.textContent = item.user.email || "";
    tr.appendChild(tdEmail);
    
    // 권한
    const tdRole = document.createElement("td");
    tdRole.textContent = item.user.role || "";
    tr.appendChild(tdRole);
    
    // 협력 구분
    const tdSubCategory = document.createElement("td");
    tdSubCategory.textContent = (item.user.role === "협력") ? (item.user.subCategory || "기타") : "";
    tr.appendChild(tdSubCategory);
    
    // 업체
    const tdCompany = document.createElement("td");
    tdCompany.textContent = item.user.company || "";
    tr.appendChild(tdCompany);
    
    // 수정 버튼
    const tdEdit = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.className = "admin-btn";
    editBtn.textContent = "수정";
    editBtn.onclick = () => openUserEditModal(item.uid);
    tdEdit.appendChild(editBtn);
    tr.appendChild(tdEdit);
    
    // 삭제 버튼
    const tdDelete = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "admin-btn";
    delBtn.textContent = "삭제";
    delBtn.onclick = () => deleteUser(item.uid);
    tdDelete.appendChild(delBtn);
    tr.appendChild(tdDelete);
    
    tbody.appendChild(tr);
  });
}


// 스케줄 목록 그리기 함수 수정 - 레이아웃 로드 후 그리기
function drawScheduleList() {
  const qStart = document.getElementById("adminQueryStart").value;
  const qEnd = document.getElementById("adminQueryEnd").value;
  const tbody = document.getElementById("adminScheduleListBody");
  tbody.innerHTML = "";

  // 조회 기간 필터
  const filtered = schedules.filter(sch =>
    (!qStart || sch.startDate >= qStart) &&
    (!qEnd || sch.startDate <= qEnd)
  );

  // 시작일 기준 정렬
  filtered.sort((a, b) => a.startDate.localeCompare(b.startDate));

  // 수정 추적 객체 초기화
  modifiedCells = {};
  
  // 먼저 테이블 레이아웃 로드 시도
  loadTableLayout().then(() => {
    // 테이블 행 그리기
    renderScheduleRows(filtered, tbody);
    
    // 테이블 컬럼 리사이징 설정
    setupTableResizing();
  });
}

// 테이블의 모든 th 요소에 resizable 클래스 추가
function addResizableClassToHeaders() {
  const headers = document.querySelectorAll('#editableScheduleTable th');
  headers.forEach(header => {
    header.classList.add('resizable');
  });
}


// 단일 행 저장 함수 추가
function saveScheduleRow(scheduleId) {
  if (!modifiedCells[scheduleId]) {
    alert("변경된 내용이 없습니다.");
    return;
  }
  
  const idx = schedules.findIndex(sch => sch.id == scheduleId);
  if (idx === -1) {
    alert("스케줄을 찾을 수 없습니다.");
    return;
  }
  
  // 변경 전 스케줄 복사 (히스토리 기록용)
  const oldSchedule = { ...schedules[idx] };
  
  // 변경 사항 적용
  for (let field in modifiedCells[scheduleId]) {
    let value = modifiedCells[scheduleId][field];
    
    // 체크박스 값(unavailable) 처리
    if (field === "unavailable") {
      value = value === true || value === "true";
    }
    
    schedules[idx][field] = value;
  }
  
  // 히스토리 기록
  recordHistory("개별 수정", currentUid, schedules[idx], oldSchedule);
  
  // Firebase에 저장
  db.ref("schedules").set(schedules)
    .then(() => {
      alert("저장되었습니다.");
      // 해당 행만 업데이트
      delete modifiedCells[scheduleId];
      return loadAllData();
    })
    .then(() => {
      const row = document.querySelector(`tr[data-id="${scheduleId}"]`);
      if (row) {
        // 변경된 셀 하이라이트 제거
        row.querySelectorAll('.cell-modified').forEach(cell => {
          cell.classList.remove('cell-modified');
        });
      }
    })
    .catch(err => {
      console.error("저장 오류:", err);
      alert(`저장 중 오류가 발생했습니다: ${err.message}`);
    });
}

// drawScheduleList 함수 끝에 추가할 코드
function forceApplyResizing() {
  const table = document.getElementById('editableScheduleTable');
  if (!table) return;
  
  const headers = table.querySelectorAll('th');
  headers.forEach(th => {
    // 기존 리사이저 제거
    const existingResizers = th.querySelectorAll('.column-resizer');
    existingResizers.forEach(r => r.remove());
    
    // 새 리사이저 추가
    const resizer = document.createElement('div');
    resizer.className = 'column-resizer';
    resizer.style.position = 'absolute';
    resizer.style.top = '0';
    resizer.style.right = '0';
    resizer.style.bottom = '0';
    resizer.style.width = '5px';
    resizer.style.cursor = 'col-resize';
    resizer.style.backgroundColor = '#e0e0e0';
    
    // th에 필요한 스타일 추가
    th.style.position = 'relative';
    th.style.overflow = 'hidden';
    
    // 리사이징 이벤트 핸들러
    resizer.addEventListener('mousedown', function(e) {
      e.preventDefault();
      const startX = e.pageX;
      const startWidth = th.offsetWidth;
      
      // 마우스 이동 이벤트
      const mouseMoveHandler = function(e) {
        const width = Math.max(50, startWidth + (e.pageX - startX));
        th.style.width = width + 'px';
        th.style.minWidth = width + 'px';
      };
      
      // 마우스 업 이벤트
      const mouseUpHandler = function() {
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
      };
      
      document.addEventListener('mousemove', mouseMoveHandler);
      document.addEventListener('mouseup', mouseUpHandler);
    });
    
    th.appendChild(resizer);
  });
}

// 테이블이 렌더링된 후 강제 리사이징 적용
setTimeout(forceApplyResizing, 500);

// 테이블 헤더에 브라우저 기본 리사이징 기능 활성화
function enableBrowserResize() {
  const table = document.getElementById('editableScheduleTable');
  if (!table) return;
  
  const headers = table.querySelectorAll('th');
  headers.forEach(th => {
    // 브라우저 기본 리사이징 활성화를 위한 CSS 설정
    th.style.position = 'relative';
    th.style.overflow = 'auto';
    th.style.resize = 'horizontal';
    th.style.minWidth = '50px';
    
    // 리사이즈 후 이벤트 처리
    th.addEventListener('mouseup', function() {
      // 너비 저장 (선택사항)
      const fieldName = th.getAttribute('data-field');
      if (fieldName) {
        try {
          const columnWidths = JSON.parse(localStorage.getItem('tableColumnWidths') || '{}');
          columnWidths[fieldName] = th.offsetWidth;
          localStorage.setItem('tableColumnWidths', JSON.stringify(columnWidths));
        } catch (err) {
          console.error('열 너비 저장 오류:', err);
        }
      }
    });
  });
}

// 테이블 로드 후 기본 리사이징 활성화
setTimeout(enableBrowserResize, 500);

// drawScheduleList 함수 마지막에 추가
function enhanceTableScrolling() {
  const tableContainer = document.getElementById('scheduleTableContainer');
  if (!tableContainer) return;
  
  // 컨테이너 스크롤 확실히 적용
  tableContainer.style.overflowX = 'scroll';
  tableContainer.style.overflowY = 'auto';
  tableContainer.style.maxWidth = '100%';
  
  // 테이블 너비 설정
  const table = document.getElementById('editableScheduleTable');
  if (table) {
    table.style.width = 'auto';
    table.style.minWidth = '100%';
    
    // 테이블 너비 계산 및 설정
    let totalWidth = 0;
    const headers = table.querySelectorAll('th');
    headers.forEach(th => {
      // 기본 너비 설정
      if (!th.style.width) {
        th.style.minWidth = '100px';
      }
      totalWidth += th.offsetWidth;
    });
    
    // 테이블 전체 너비가 컨테이너보다 작으면 최소 너비 설정
    if (totalWidth < tableContainer.offsetWidth) {
      table.style.minWidth = tableContainer.offsetWidth + 'px';
    } else {
      table.style.minWidth = totalWidth + 'px';
    }
  }
  
  // 스크롤 위치 초기화
  tableContainer.scrollLeft = 0;
}

// 테이블 로드 후 스크롤 기능 강화
setTimeout(enhanceTableScrolling, 600);

// 리사이징 시 스크롤 업데이트
function updateScrollAfterResize() {
  const headers = document.querySelectorAll('#editableScheduleTable th');
  headers.forEach(th => {
    th.addEventListener('mouseup', function() {
      // 리사이징 후 스크롤 업데이트
      setTimeout(enhanceTableScrolling, 100);
    });
  });
}

// 리사이징 후 스크롤 업데이트 기능 추가
setTimeout(updateScrollAfterResize, 700);

// 테이블 헤더 리사이징 및 전체 테이블 너비 동기화 함수
function enhanceTableResizing() {
  const table = document.getElementById('editableScheduleTable');
  const tableContainer = document.getElementById('scheduleTableContainer');
  if (!table || !tableContainer) return;
  
  const headers = table.querySelectorAll('th');
  
  headers.forEach(th => {
    // 이미 초기화된 경우 건너뛰기
    if (th.getAttribute('data-resize-initialized') === 'true') return;
    
    // 리사이저 요소 생성
    const resizer = document.createElement('div');
    resizer.className = 'column-resizer';
    resizer.style.position = 'absolute';
    resizer.style.top = '0';
    resizer.style.right = '0';
    resizer.style.bottom = '0';
    resizer.style.width = '8px';
    resizer.style.cursor = 'col-resize';
    resizer.style.zIndex = '10';
    resizer.style.backgroundColor = 'transparent';
    
    // 호버 상태 스타일
    resizer.addEventListener('mouseover', () => {
      resizer.style.backgroundColor = 'rgba(0, 120, 215, 0.3)';
    });
    
    resizer.addEventListener('mouseout', () => {
      resizer.style.backgroundColor = 'transparent';
    });
    
    // 리사이징 이벤트 처리
    resizer.addEventListener('mousedown', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // 초기 위치와 너비 기록
      const startX = e.pageX;
      const startWidth = th.offsetWidth;
      const tableStartWidth = table.offsetWidth;
      
      // 마우스 이동 이벤트
      function onMouseMove(e) {
        // 새 너비 계산 (최소 50px)
        const newWidth = Math.max(50, startWidth + (e.pageX - startX));
        const widthDiff = newWidth - startWidth;
        
        // 열 너비 업데이트
        th.style.width = newWidth + 'px';
        th.style.minWidth = newWidth + 'px';
        
        // 테이블 전체 너비 업데이트 (증가된 만큼 추가)
        const newTableWidth = tableStartWidth + widthDiff;
        table.style.width = newTableWidth + 'px';
        table.style.minWidth = newTableWidth + 'px';
        
        // 스크롤 위치 조정 (선택 사항)
        if (widthDiff > 0) {
          tableContainer.scrollLeft += (widthDiff / 2);
        }
      }
      
      // 마우스 업 이벤트
      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        // 필드명 기반 너비 저장
        const fieldName = th.getAttribute('data-field');
        if (fieldName) {
          try {
            const columnWidths = JSON.parse(localStorage.getItem('tableColumnWidths') || '{}');
            columnWidths[fieldName] = th.offsetWidth;
            localStorage.setItem('tableColumnWidths', JSON.stringify(columnWidths));
          } catch (err) {
            console.error('열 너비 저장 오류:', err);
          }
        }
        
        // 너비 변경 후 테이블 레이아웃 업데이트
        saveTableLayout();
      }
      
      // 전역 이벤트 리스너 등록
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      
      // 리사이저 활성 상태 표시
      resizer.style.backgroundColor = 'rgba(0, 120, 215, 0.5)';
    });
    
    // 테이블 헤더에 리사이저 추가
    th.style.position = 'relative';
    th.appendChild(resizer);
    
    // 초기화 완료 표시
    th.setAttribute('data-resize-initialized', 'true');
  });
  
  // 필요하다면 테이블 초기 너비 설정
  calculateInitialTableWidth();
}

// 테이블 초기 너비 계산 함수
function calculateInitialTableWidth() {
  const table = document.getElementById('editableScheduleTable');
  if (!table) return;
  
  // 모든 열의 너비 합산
  let totalWidth = 0;
  const headers = table.querySelectorAll('th');
  
  headers.forEach(th => {
    // 저장된 너비 적용
    const fieldName = th.getAttribute('data-field');
    if (fieldName) {
      try {
        const columnWidths = JSON.parse(localStorage.getItem('tableColumnWidths') || '{}');
        if (columnWidths[fieldName]) {
          th.style.width = columnWidths[fieldName] + 'px';
          th.style.minWidth = columnWidths[fieldName] + 'px';
          totalWidth += columnWidths[fieldName];
        } else {
          // 기본 너비 설정
          th.style.width = '100px';
          th.style.minWidth = '100px';
          totalWidth += 100;
        }
      } catch (err) {
        console.error('열 너비 로드 오류:', err);
        th.style.width = '100px';
        th.style.minWidth = '100px';
        totalWidth += 100;
      }
    } else {
      th.style.width = '100px';
      th.style.minWidth = '100px';
      totalWidth += 100;
    }
  });
  
  // 테이블 전체 너비 설정
  table.style.width = totalWidth + 'px';
  table.style.minWidth = totalWidth + 'px';
}

// 테이블 스타일 초기화 및 스크롤 설정
function initializeTableStyles() {
  const tableContainer = document.getElementById('scheduleTableContainer');
  if (!tableContainer) return;
  
  // 컨테이너 스크롤 스타일 강제 적용
  tableContainer.style.overflowX = 'scroll';
  tableContainer.style.overflowY = 'auto';
  tableContainer.style.width = '100%';
  tableContainer.style.position = 'relative';
  tableContainer.style.border = '1px solid #ddd';
  tableContainer.style.borderRadius = '4px';
  
  // 테이블 스타일 설정
  const table = document.getElementById('editableScheduleTable');
  if (table) {
    table.style.tableLayout = 'fixed';
    table.style.borderCollapse = 'collapse';
  }
}

// 이 함수들을 drawScheduleList 함수의 마지막 부분에 호출
function setupTableEnhancements() {
  // 초기 스타일 설정
  initializeTableStyles();
  
  // 첫 번째로 테이블 초기 너비 계산
  calculateInitialTableWidth();
  
  // 테이블 리사이징 기능 향상
  enhanceTableResizing();
}

// 타이밍 문제를 해결하기 위해 약간의 지연 후 실행
setTimeout(setupTableEnhancements, 500);

// 방선일 자동 계산 함수
function updateDepartureDate(tr) {
  const startDateInput = tr.querySelector('[data-field="startDate"]');
  const endDateInput = tr.querySelector('[data-field="endDate"]');
  const departureDateInput = tr.querySelector('[data-field="departureDate"]');
  
  if (!endDateInput || !departureDateInput) return;
  
  const endDateValue = endDateInput.value;
  if (!endDateValue) return;
  
  // 종료일 기준으로 방선일 계산 (종료일 + 1일)
  const endDate = new Date(endDateValue);
  if (!isNaN(endDate.getTime())) {
    endDate.setDate(endDate.getDate() + 1);
    const departureDate = endDate.toISOString().substring(0, 10);
    
    // 방선일 기존 값과 다르면 업데이트
    if (departureDateInput.value !== departureDate) {
      departureDateInput.value = departureDate;
      trackChange(departureDateInput);
    }
  }
}

// 스케줄 행 렌더링 함수 개선
function renderScheduleRows(filtered, tbody) {
  // 이전에 작성된 행 모두 제거
  tbody.innerHTML = "";
  
  // 필터링된 스케줄이 없는 경우 메시지 표시
  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 22; // 모든 열을 차지하도록 설정
    td.textContent = "조회 기간에 해당하는 스케줄이 없습니다.";
    td.style.textAlign = "center";
    td.style.padding = "20px";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  
  // 회사 목록 수집 (업체 드롭다운용)
  const companies = new Set();
  for (const uid in users) {
    if (users[uid].company && users[uid].company.trim() !== '') {
      companies.add(users[uid].company.trim());
    }
  }
  const sortedCompanies = Array.from(companies).sort();
  
  // 필터링된 각 스케줄에 대해 행 생성
  filtered.forEach(sch => {
    const tr = document.createElement("tr");
    tr.setAttribute("data-id", sch.id);
    
    // 1. ETA (도착예정) - 날짜 선택기로 변경
    const etaCell = document.createElement("td");
    const etaInput = document.createElement("input");
    etaInput.type = "date";
    etaInput.value = sch.eta || "";
    etaInput.setAttribute("data-field", "eta");
    etaInput.setAttribute("data-original", sch.eta || "");
    etaInput.style.width = "100%";
    etaInput.style.padding = "4px";
    etaInput.style.border = "1px solid #ddd";
    etaInput.style.borderRadius = "4px";
    etaInput.style.backgroundColor = "#fff";
    etaInput.onchange = function() { trackChange(this); };
    etaCell.appendChild(etaInput);
    tr.appendChild(etaCell);
    
    // 2. ETB (접안예정) - 날짜 선택기로 변경
    const etbCell = document.createElement("td");
    const etbInput = document.createElement("input");
    etbInput.type = "date";
    etbInput.value = sch.etb || "";
    etbInput.setAttribute("data-field", "etb");
    etbInput.setAttribute("data-original", sch.etb || "");
    etbInput.style.width = "100%";
    etbInput.style.padding = "4px";
    etbInput.style.border = "1px solid #ddd";
    etbInput.style.borderRadius = "4px";
    etbInput.style.backgroundColor = "#fff";
    etbInput.onchange = function() { trackChange(this); };
    etbCell.appendChild(etbInput);
    tr.appendChild(etbCell);
    
    // 3. ETD (출항예정) - 날짜 선택기로 변경
    const etdCell = document.createElement("td");
    const etdInput = document.createElement("input");
    etdInput.type = "date";
    etdInput.value = sch.etd || "";
    etdInput.setAttribute("data-field", "etd");
    etdInput.setAttribute("data-original", sch.etd || "");
    etdInput.style.width = "100%";
    etdInput.style.padding = "4px";
    etdInput.style.border = "1px solid #ddd";
    etdInput.style.borderRadius = "4px";
    etdInput.style.backgroundColor = "#fff";
    etdInput.onchange = function() { trackChange(this); };
    etdCell.appendChild(etdInput);
    tr.appendChild(etdCell);
    
    // 4. 지역
    const regionCell = document.createElement("td");
    const regionInput = document.createElement("input");
    regionInput.type = "text";
    regionInput.value = sch.regionName || "";
    regionInput.setAttribute("data-field", "regionName");
    regionInput.setAttribute("data-original", sch.regionName || "");
    regionInput.style.width = "100%";
    regionInput.style.padding = "4px";
    regionInput.style.border = "1px solid #ddd";
    regionInput.style.borderRadius = "4px";
    regionInput.style.backgroundColor = "#fff";
    regionInput.onchange = function() { trackChange(this); };
    regionCell.appendChild(regionInput);
    tr.appendChild(regionCell);
    
    // 5. 국가 - 검색 및 선택 기능 추가
    const countryCell = document.createElement("td");
    const countryInputContainer = document.createElement("div");
    countryInputContainer.style.position = "relative";
    
    const countryInput = document.createElement("input");
    countryInput.type = "text";
    countryInput.value = sch.country || "";
    countryInput.setAttribute("data-field", "country");
    countryInput.setAttribute("data-original", sch.country || "");
    countryInput.setAttribute("placeholder", "국가 검색...");
    countryInput.style.width = "100%";
    countryInput.style.padding = "4px";
    countryInput.style.border = "1px solid #ddd";
    countryInput.style.borderRadius = "4px";
    countryInput.style.backgroundColor = "#fff";
    
    // 국가 검색 드롭다운
    const countryDropdown = document.createElement("div");
    countryDropdown.className = "country-dropdown";
    countryDropdown.style.display = "none";
    countryDropdown.style.position = "absolute";
    countryDropdown.style.width = "100%";
    countryDropdown.style.maxHeight = "150px";
    countryDropdown.style.overflowY = "auto";
    countryDropdown.style.border = "1px solid #ddd";
    countryDropdown.style.backgroundColor = "#fff";
    countryDropdown.style.zIndex = "100";
    countryDropdown.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
    
    // 국가 검색 이벤트
    countryInput.oninput = function() {
      const filter = this.value.toLowerCase();
      if(filter.length < 1) {
        countryDropdown.style.display = "none";
        return;
      }
      
      countryDropdown.innerHTML = "";
      const filtered = countryList.filter(country => 
        country.toLowerCase().includes(filter)
      );
      
      if(filtered.length === 0) {
        countryDropdown.style.display = "none";
        return;
      }
      
      filtered.slice(0, 10).forEach(country => {
        const item = document.createElement("div");
        item.textContent = country;
        item.style.padding = "5px";
        item.style.cursor = "pointer";
        item.style.transition = "background 0.2s";
        
        item.onmouseover = function() {
          this.style.backgroundColor = "#f0f0f0";
        };
        
        item.onmouseout = function() {
          this.style.backgroundColor = "";
        };
        
        item.onclick = function() {
          countryInput.value = country;
          countryDropdown.style.display = "none";
          trackChange(countryInput);
        };
        
        countryDropdown.appendChild(item);
      });
      
      countryDropdown.style.display = "block";
    };
    
    // 포커스 잃었을 때 드롭다운 숨기기
    countryInput.onblur = function() {
      setTimeout(() => {
        countryDropdown.style.display = "none";
        trackChange(this);
      }, 200);
    };
    
    countryInputContainer.appendChild(countryInput);
    countryInputContainer.appendChild(countryDropdown);
    countryCell.appendChild(countryInputContainer);
    tr.appendChild(countryCell);
    
// 6. IMO 번호
    const imoCell = document.createElement("td");
    const imoInput = document.createElement("input");
    imoInput.type = "text";
    imoInput.value = sch.imoNo || "";
    imoInput.setAttribute("data-field", "imoNo");
    imoInput.setAttribute("data-original", sch.imoNo || "");
    imoInput.style.width = "100%";
    imoInput.style.padding = "4px";
    imoInput.style.border = "1px solid #ddd";
    imoInput.style.borderRadius = "4px";
    imoInput.style.backgroundColor = "#fff";
    imoInput.onchange = async function() { 
      trackChange(this);
      
      // IMO 번호로 AS 데이터베이스에서 선박 정보 조회
      const imoValue = this.value.trim();
      if (imoValue) {
        const shipData = await fetchShipDataFromAsDatabase(imoValue);
        if (shipData) {
          console.log('AS 데이터베이스에서 찾은 선박 정보:', shipData);
          
          // 같은 행의 선박 정보 필드들 업데이트
          const currentTr = this.closest('tr');
          
          // Ship Name 업데이트
          const shipNameInput = currentTr.querySelector('[data-field="lineName"]');
          if (shipNameInput && !shipNameInput.value.trim()) {
            shipNameInput.value = shipData.shipName;
            trackChange(shipNameInput);
          }
          
          // Shipowner 업데이트
          const shipownerSelect = currentTr.querySelector('[data-field="company"]');
          if (shipownerSelect && shipData.shipowner) {
            // 드롭다운에서 해당 회사 찾기
            for (let i = 0; i < shipownerSelect.options.length; i++) {
              if (shipownerSelect.options[i].value === shipData.shipowner) {
                shipownerSelect.value = shipData.shipowner;
                trackChange(shipownerSelect);
                break;
              }
            }
          }
          
          // Hull No. 업데이트
          const hullInput = currentTr.querySelector('[data-field="hull"]');
          if (hullInput && !hullInput.value.trim()) {
            hullInput.value = shipData.hull;
            trackChange(hullInput);
          }
        }
      }
    };
    imoCell.appendChild(imoInput);
    tr.appendChild(imoCell);
    
    // 7. HULL 번호
    const hullCell = document.createElement("td");
    const hullInput = document.createElement("input");
    hullInput.type = "text";
    hullInput.value = sch.hullNo || "";
    hullInput.setAttribute("data-field", "hullNo");
    hullInput.setAttribute("data-original", sch.hullNo || "");
    hullInput.style.width = "100%";
    hullInput.style.padding = "4px";
    hullInput.style.border = "1px solid #ddd";
    hullInput.style.borderRadius = "4px";
    hullInput.style.backgroundColor = "#fff";
    hullInput.onchange = function() { trackChange(this); };
    hullCell.appendChild(hullInput);
    tr.appendChild(hullCell);
    
    // 8. SHIP NAME
    const shipNameCell = document.createElement("td");
    const shipNameInput = document.createElement("input");
    shipNameInput.type = "text";
    shipNameInput.value = sch.lineName || "";
    shipNameInput.setAttribute("data-field", "lineName");
    shipNameInput.setAttribute("data-original", sch.lineName || "");
    shipNameInput.style.width = "100%";
    shipNameInput.style.padding = "4px";
    shipNameInput.style.border = "1px solid #ddd";
    shipNameInput.style.borderRadius = "4px";
    shipNameInput.style.backgroundColor = "#fff";
    shipNameInput.onchange = function() { trackChange(this); };
    shipNameCell.style.minWidth = "200px";
    shipNameCell.style.maxWidth = "600px"; 
    shipNameCell.style.width = "300px";
    shipNameCell.appendChild(shipNameInput);
    tr.appendChild(shipNameCell);
    
    // 9. 담당자 (select 박스)
    const managerCell = document.createElement("td");
    const managerSelect = document.createElement("select");
    managerSelect.setAttribute("data-field", "managerId");
    managerSelect.setAttribute("data-original", sch.managerId || "");
    managerSelect.style.width = "100%";
    managerSelect.style.padding = "4px";
    managerSelect.style.border = "1px solid #ddd";
    managerSelect.style.borderRadius = "4px";
    managerSelect.style.backgroundColor = "#fff";
    managerSelect.onchange = function() { trackChange(this); };
    
    // 담당자 목록 추가
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "-- 선택 --";
    managerSelect.appendChild(emptyOption);
    
    for (const uid in users) {
      if (users[uid].role === "본사" || isAdminRole(users[uid].role)) {
        const option = document.createElement("option");
        option.value = uid;
        option.textContent = users[uid].id || "담당자";
        
        if (uid === sch.managerId) {
          option.selected = true;
        }
        
        managerSelect.appendChild(option);
      }
    }
    
    managerCell.appendChild(managerSelect);
    tr.appendChild(managerCell);
    
    // 10. 업체 (직접 입력에서 드롭다운으로 변경)
    const companyCell = document.createElement("td");
    const companySelect = document.createElement("select");
    companySelect.setAttribute("data-field", "company");
    
    // 현재 업체 값 가져오기
    const userObj = users[sch.userId] || {};
    const currentCompany = userObj.company || "";
    companySelect.setAttribute("data-original", currentCompany);
    
    companySelect.style.width = "100%";
    companySelect.style.padding = "4px";
    companySelect.style.border = "1px solid #ddd";
    companySelect.style.borderRadius = "4px";
    companySelect.style.backgroundColor = "#fff";
    
    // 빈 옵션 추가
    const emptyCompOption = document.createElement("option");
    emptyCompOption.value = "";
    emptyCompOption.textContent = "-- 선택 --";
    companySelect.appendChild(emptyCompOption);
    
    // 회사 목록 추가
    sortedCompanies.forEach(company => {
      const option = document.createElement("option");
      option.value = company;
      option.textContent = company;
      
      if (company === currentCompany) {
        option.selected = true;
      }
      
      companySelect.appendChild(option);
    });
    
    // 업체 변경 시 엔지니어 목록 필터링
    companySelect.onchange = function() {
      const selectedCompany = this.value;
      
      // 엔지니어 셀렉트 박스 참조
      const engineerSelect = tr.querySelector('[data-field="userId"]');
      if (!engineerSelect) return;
      
      // 현재 선택된 엔지니어 UID 기억
      const currentEngineerUid = engineerSelect.value;
      
      // 엔지니어 목록 재구성
      engineerSelect.innerHTML = "";
      
      // 빈 옵션 추가
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "-- 선택 --";
      engineerSelect.appendChild(emptyOption);
      
      // 필터링된 엔지니어 옵션 추가
      let engineerOptions = [];
      for (const uid in users) {
        if (users[uid].role === "협력") {
          if (!selectedCompany || users[uid].company === selectedCompany) {
            engineerOptions.push({
              uid: uid,
              name: users[uid].id || "NONAME",
              company: users[uid].company || "업체 미지정"
            });
          }
        }
      }
      
      // 이름 기준으로 정렬
      engineerOptions.sort((a, b) => a.name.localeCompare(b.name));
      
      // 엔지니어 옵션 추가
      engineerOptions.forEach(optData => {
        const option = document.createElement("option");
        option.value = optData.uid;
        option.textContent = `${optData.name} (${optData.company})`;
        
        if (optData.uid === currentEngineerUid) {
          option.selected = true;
        }
        
        engineerSelect.appendChild(option);
      });
      
      // 변경 추적
      trackChange(this);
    };
    
    companyCell.appendChild(companySelect);
    tr.appendChild(companyCell);
    
    // 11. 엔지니어 (select 박스)
    const engineerCell = document.createElement("td");
    const engineerSelect = document.createElement("select");
    engineerSelect.setAttribute("data-field", "userId");
    engineerSelect.setAttribute("data-original", sch.userId || "");
    engineerSelect.style.width = "100%";
    engineerSelect.style.padding = "4px";
    engineerSelect.style.border = "1px solid #ddd";
    engineerSelect.style.borderRadius = "4px";
    engineerSelect.style.backgroundColor = "#fff";
    engineerSelect.onchange = function() { trackChange(this); };
    
    // 엔지니어 목록 추가
    const emptyEngOption = document.createElement("option");
    emptyEngOption.value = "";
    emptyEngOption.textContent = "-- 선택 --";
    engineerSelect.appendChild(emptyEngOption);
    
    // 엔지니어 옵션 목록 생성
    let engineerOptions = [];
    for (const uid in users) {
      if (users[uid].role === "협력") {
        if (!currentCompany || users[uid].company === currentCompany) {
          engineerOptions.push({
            uid: uid,
            name: users[uid].id || "NONAME",
            company: users[uid].company || "업체 미지정"
          });
        }
      }
    }
    
    // 이름 기준으로 정렬
    engineerOptions.sort((a, b) => a.name.localeCompare(b.name));
    
    // 엔지니어 옵션 추가
    engineerOptions.forEach(optData => {
      const option = document.createElement("option");
      option.value = optData.uid;
      option.textContent = `${optData.name} (${optData.company})`;
      
      if (optData.uid === sch.userId) {
        option.selected = true;
      }
      
      engineerSelect.appendChild(option);
    });
    
    engineerCell.appendChild(engineerSelect);
    tr.appendChild(engineerCell);


    // 12. AS NO. 
const asNoCell = document.createElement("td");
const asNoInput = document.createElement("input");
asNoInput.type = "text";
asNoInput.value = sch.asNo || "";
asNoInput.setAttribute("data-field", "asNo");
asNoInput.setAttribute("data-original", sch.asNo || "");
asNoInput.style.width = "100%";
asNoInput.style.padding = "4px";
asNoInput.style.border = "1px solid #ddd";
asNoInput.style.borderRadius = "4px";
asNoInput.style.backgroundColor = "#fff";
asNoInput.onchange = function() { trackChange(this); };
asNoCell.appendChild(asNoInput);
tr.appendChild(asNoCell);
    
    // 13. AS 구분
    const asTypeCell = document.createElement("td");
    const asTypeSelect = document.createElement("select");
    asTypeSelect.setAttribute("data-field", "asType");
    asTypeSelect.setAttribute("data-original", sch.asType || "");
    asTypeSelect.style.width = "100%";
    asTypeSelect.style.padding = "4px";
    asTypeSelect.style.border = "1px solid #ddd";
    asTypeSelect.style.borderRadius = "4px";
    asTypeSelect.style.backgroundColor = "#fff";
    asTypeSelect.onchange = function() { trackChange(this); };
    
    // AS 구분 옵션 추가
    const asOptions = ["", "유상", "무상", "위탁"];
    asOptions.forEach(opt => {
      const option = document.createElement("option");
      option.value = opt;
      option.textContent = opt || "-- 선택 --";
      
      if (opt === sch.asType) {
        option.selected = true;
      }
      
      asTypeSelect.appendChild(option);
    });
    
    asTypeCell.appendChild(asTypeSelect);
    tr.appendChild(asTypeCell);
    
    // 14. 시작일
    const startDateCell = document.createElement("td");
    const startDateInput = document.createElement("input");
    startDateInput.type = "date";
    startDateInput.value = sch.startDate || "";
    startDateInput.setAttribute("data-field", "startDate");
    startDateInput.setAttribute("data-original", sch.startDate || "");
    startDateInput.style.width = "100%";
    startDateInput.style.padding = "4px";
    startDateInput.style.border = "1px solid #ddd";
    startDateInput.style.borderRadius = "4px";
    startDateInput.style.backgroundColor = "#fff";
    startDateInput.onchange = function() { 
      trackChange(this);
      // 종료일과 방선일 관계 업데이트
      updateDepartureDate(tr);
    };
    startDateCell.appendChild(startDateInput);
    tr.appendChild(startDateCell);
    
    // 15. 종료일
    const endDateCell = document.createElement("td");
    const endDateInput = document.createElement("input");
    endDateInput.type = "date";
    endDateInput.value = sch.endDate || "";
    endDateInput.setAttribute("data-field", "endDate");
    endDateInput.setAttribute("data-original", sch.endDate || "");
    endDateInput.style.width = "100%";
    endDateInput.style.padding = "4px";
    endDateInput.style.border = "1px solid #ddd";
    endDateInput.style.borderRadius = "4px";
    endDateInput.style.backgroundColor = "#fff";
    endDateInput.onchange = function() { 
      trackChange(this);
      // 종료일과 방선일 관계 업데이트
      updateDepartureDate(tr);
    };
    endDateCell.appendChild(endDateInput);
    tr.appendChild(endDateCell);
    
    // 16. 방선일
    const departureDateCell = document.createElement("td");
    const departureDateInput = document.createElement("input");
    departureDateInput.type = "date";
    departureDateInput.value = sch.departureDate || "";
    departureDateInput.setAttribute("data-field", "departureDate");
    departureDateInput.setAttribute("data-original", sch.departureDate || "");
    departureDateInput.style.width = "100%";
    departureDateInput.style.padding = "4px";
    departureDateInput.style.border = "1px solid #ddd";
    departureDateInput.style.borderRadius = "4px";
    departureDateInput.style.backgroundColor = "#fff";
    departureDateInput.onchange = function() { trackChange(this); };
    departureDateCell.appendChild(departureDateInput);
    tr.appendChild(departureDateCell);
    
    // 17. 취소 사유
    const cancelReasonCell = document.createElement("td");
    const cancelReasonInput = document.createElement("input");
    cancelReasonInput.type = "text";
    cancelReasonInput.value = sch.cancelReason || "";
    cancelReasonInput.setAttribute("data-field", "cancelReason");
    cancelReasonInput.setAttribute("data-original", sch.cancelReason || "");
    cancelReasonInput.style.width = "100%";
    cancelReasonInput.style.padding = "4px";
    cancelReasonInput.style.border = "1px solid #ddd";
    cancelReasonInput.style.borderRadius = "4px";
    cancelReasonInput.style.backgroundColor = "#fff";
    cancelReasonInput.onchange = function() { trackChange(this); };
    cancelReasonCell.appendChild(cancelReasonInput);
    tr.appendChild(cancelReasonCell);
    
    // 18. 상태
    const statusCell = document.createElement("td");
    const statusSelect = document.createElement("select");
    statusSelect.className = "status-select";
    statusSelect.setAttribute("data-field", "status");
    statusSelect.setAttribute("data-original", sch.status || "");
    statusSelect.style.width = "100%";
    statusSelect.style.padding = "4px";
    statusSelect.style.border = "1px solid #ddd";
    statusSelect.style.borderRadius = "4px";
    statusSelect.style.backgroundColor = "#fff";
    statusSelect.onchange = function() { trackChange(this); };
    
    // 상태 옵션 추가
    const statusOptions = [
      "", "일정 등록 대기", "일정 등록", "일정 변경", "일정 취소", 
      "일정 확정", "일정 변경 / 최종 확정", "서비스 완료"
    ];
    statusOptions.forEach(opt => {
      const option = document.createElement("option");
      option.value = opt;
      option.textContent = opt || "-- 선택 --";
      
      if (opt === sch.status) {
        option.selected = true;
      }
      
      statusSelect.appendChild(option);
    });
    
    statusCell.appendChild(statusSelect);
    tr.appendChild(statusCell);
    
    // 19. 상세
    const detailsCell = document.createElement("td");
    const detailsTextarea = document.createElement("textarea");
    detailsTextarea.value = sch.details || "";
    detailsTextarea.setAttribute("data-field", "details");
    detailsTextarea.setAttribute("data-original", sch.details || "");
    detailsTextarea.style.width = "100%";
    detailsTextarea.style.padding = "4px";
    detailsTextarea.style.border = "1px solid #ddd";
    detailsTextarea.style.borderRadius = "4px";
    detailsTextarea.style.backgroundColor = "#fff";
    detailsTextarea.style.minHeight = "60px";
    detailsTextarea.style.resize = "vertical";
    detailsTextarea.onchange = function() { trackChange(this); };
    detailsCell.style.minWidth = "200px";
    detailsCell.style.maxWidth = "600px"; 
    detailsCell.style.width = "300px";
    detailsCell.appendChild(detailsTextarea);
    tr.appendChild(detailsCell);
    
    // 20. 전달사항
    const messageCell = document.createElement("td");
    const messageTextarea = document.createElement("textarea");
    messageTextarea.value = sch.message || "";
    messageTextarea.setAttribute("data-field", "message");
    messageTextarea.setAttribute("data-original", sch.message || "");
    messageTextarea.style.width = "100%";
    messageTextarea.style.padding = "4px";
    messageTextarea.style.border = "1px solid #ddd";
    messageTextarea.style.borderRadius = "4px";
    messageTextarea.style.backgroundColor = "#fff";
    messageTextarea.style.minHeight = "60px";
    messageTextarea.style.resize = "vertical";
    messageTextarea.onchange = function() { trackChange(this); };
    messageCell.style.minWidth = "200px";
    messageCell.style.maxWidth = "600px"; 
    messageCell.style.width = "300px";
    messageCell.appendChild(messageTextarea);
    tr.appendChild(messageCell);
    
    // 21. 서비스 불가 (체크박스)
    const unavailableCell = document.createElement("td");
    const unavailableCheckbox = document.createElement("input");
    unavailableCheckbox.type = "checkbox";
    unavailableCheckbox.checked = !!sch.unavailable;
    unavailableCheckbox.className = "schedule-checkbox";
    unavailableCheckbox.setAttribute("data-field", "unavailable");
    unavailableCheckbox.setAttribute("data-original", sch.unavailable ? "true" : "false");
    unavailableCheckbox.style.width = "20px";
    unavailableCheckbox.style.height = "20px";
    unavailableCheckbox.onchange = function() { trackChange(this); };
    unavailableCell.style.textAlign = "center";
    unavailableCell.appendChild(unavailableCheckbox);
    tr.appendChild(unavailableCell);
    
    // 22. 작업 (버튼 영역)
    const actionCell = document.createElement("td");
    
    // 저장 버튼
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "저장";
    saveBtn.className = "row-action-btn";
    saveBtn.onclick = function() { saveScheduleRow(sch.id); };
    actionCell.appendChild(saveBtn);
    
    // 삭제 버튼
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "삭제";
    deleteBtn.className = "row-action-btn delete";
    deleteBtn.onclick = function() { 
      if (confirm("이 스케줄을 삭제하시겠습니까?")) {
        deleteAdminSchedule(sch.id);
      }
    };
    actionCell.appendChild(deleteBtn);
    
    tr.appendChild(actionCell);
    
    // 행을 테이블에 추가
    tbody.appendChild(tr);
  });
  
  // 테이블 스크롤 기능 개선
  const tableContainer = document.getElementById('scheduleTableContainer');
  if (tableContainer) {
    // 스크롤바 스타일 개선
    tableContainer.style.overflowX = "auto";
    tableContainer.style.maxWidth = "100%";
    tableContainer.style.width = "100%";
    
    // 테이블 최소 넓이 설정
    const table = document.getElementById('editableScheduleTable');
    if (table) {
      table.style.minWidth = "100%";
      table.style.width = "auto";
    }
    
    // 각 th 요소에 리사이징 핸들 추가 및 스타일 조정
    const ths = document.querySelectorAll('#editableScheduleTable th');
    ths.forEach(th => {
      th.style.position = "relative";
      
      // 리사이징 핸들이 있는지 확인
      if (!th.querySelector('.column-resizer')) {
        const resizer = document.createElement('div');
        resizer.className = 'column-resizer';
        resizer.style.position = "absolute";
        resizer.style.top = "0";
        resizer.style.right = "0";
        resizer.style.bottom = "0";
        resizer.style.width = "5px";
        resizer.style.cursor = "col-resize";
        resizer.style.backgroundColor = "transparent";
        
        resizer.addEventListener('mousedown', function(e) {
          const startX = e.pageX;
          const startWidth = th.offsetWidth;
          
          function onMouseMove(e) {
            const width = Math.max(50, startWidth + (e.pageX - startX));
            th.style.width = width + 'px';
            th.style.minWidth = width + 'px';
            
            // 저장 및 복원을 위한 데이터 속성 설정
            const fieldName = th.getAttribute('data-field');
            if (fieldName) {
              try {
                const columnWidths = JSON.parse(localStorage.getItem('tableColumnWidths') || '{}');
                columnWidths[fieldName] = width;
                localStorage.setItem('tableColumnWidths', JSON.stringify(columnWidths));
              } catch (err) {
                console.error('열 너비 저장 오류:', err);
              }
            }
          }
          
          function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
          }
          
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
          document.body.style.cursor = 'col-resize';
          e.preventDefault();
        });
        
        th.appendChild(resizer);
      }
      
      // 저장된 너비 적용
      const fieldName = th.getAttribute('data-field');
      if (fieldName) {
        try {
          const columnWidths = JSON.parse(localStorage.getItem('tableColumnWidths') || '{}');
          if (columnWidths[fieldName]) {
            th.style.width = columnWidths[fieldName] + 'px';
            th.style.minWidth = columnWidths[fieldName] + 'px';
          }
        } catch (err) {
          console.error('열 너비 로드 오류:', err);
        }
      }
    });
  }
}

// 새 스케줄 행 추가 함수
function addNewScheduleRow() {
  // 새 스케줄 ID 생성
  const newId = Date.now();
  
  // 현재 날짜 기반의 시작일/종료일 설정
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  const startDate = today.toISOString().slice(0, 10);
  const endDate = tomorrow.toISOString().slice(0, 10);
  
  // 기본 스케줄 객체 생성
  const newSchedule = {
    id: newId,
    startDate: startDate,
    endDate: endDate,
    status: "일정 등록 대기",
    unavailable: false
  };
  
  // 스케줄 배열에 추가
  schedules.push(newSchedule);
  
  // 테이블 다시 그리기
  drawScheduleList();
  
  // 새 행으로 스크롤
  setTimeout(() => {
    const newRow = document.querySelector(`tr[data-id="${newId}"]`);
    if (newRow) {
      newRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      newRow.style.animation = 'highlight 2s';
    }
  }, 100);
  
  return newId;
}
// 변경 내용 추적 함수 수정
function trackChange(element) {
  const field = element.getAttribute("data-field");
  const original = element.getAttribute("data-original");
  let currentValue;
  
  if (element.type === "checkbox") {
    currentValue = element.checked;
  } else if (element.tagName === "SELECT") {
    currentValue = element.value;
  } else if (element.tagName === "INPUT") {
    currentValue = element.value;
  } else {
    currentValue = element.textContent.trim();
  }
  
  // tr 엘리먼트를 찾기 위해 부모 엘리먼트 탐색
  let parentNode = element;
  while (parentNode && parentNode.tagName !== "TR") {
    parentNode = parentNode.parentNode;
  }
  
  if (!parentNode) {
    console.error("부모 TR 요소를 찾을 수 없습니다.");
    return;
  }
  
  // 원래 값과 비교하여 변경 여부 확인
  let isChanged = false;
  if (element.type === "checkbox") {
    isChanged = (original === "true" && !currentValue) || (original === "false" && currentValue);
  } else {
    isChanged = String(original) !== String(currentValue);
  }
  
  // 변경된 경우 셀 하이라이트 및 수정 객체에 추가
  const scheduleId = parentNode.getAttribute("data-id");
  
  if (isChanged) {
    element.classList.add("cell-modified");
    
    if (!modifiedCells[scheduleId]) {
      modifiedCells[scheduleId] = {};
    }
    
    modifiedCells[scheduleId][field] = currentValue;
  } else {
    element.classList.remove("cell-modified");
    
    if (modifiedCells[scheduleId] && modifiedCells[scheduleId][field]) {
      delete modifiedCells[scheduleId][field];
      
      // 해당 스케줄의 모든 변경사항이 취소된 경우 객체에서 제거
      if (Object.keys(modifiedCells[scheduleId]).length === 0) {
        delete modifiedCells[scheduleId];
      }
    }
  }
}

// 전체 변경 사항 저장 함수
// 기존 함수 확장: 변경사항 저장 시 테이블 폭도 함께 저장
// 변경사항 저장 함수 수정 - 테이블 레이아웃 저장 포함
function saveScheduleTable() {
  // 변경된 내용이 없는 경우
  if (Object.keys(modifiedCells).length === 0) {
    // 테이블 레이아웃만 저장
    saveTableLayout();
    alert("스케줄 변경사항은 없지만, 테이블 레이아웃이 저장되었습니다.");
    return;
  }
  
  // 변경 내용 확인
  if (!confirm(`총 ${Object.keys(modifiedCells).length}개의 일정이 변경됩니다. 저장하시겠습니까?`)) {
    return;
  }
  
  // 테이블 레이아웃 저장
  saveTableLayout();
  
  // 이하 기존 코드 (스케줄 변경사항 저장)
  let changeCount = 0;
  let hasErrors = false;
  
  // 스케줄 배열 순회하며 변경사항 적용
  for (let scheduleId in modifiedCells) {
    const idx = schedules.findIndex(sch => sch.id == scheduleId);
    
    if (idx === -1) {
      console.error(`스케줄 ID ${scheduleId}를 찾을 수 없습니다.`);
      hasErrors = true;
      continue;
    }
    
    // 변경 전 스케줄 복사 (히스토리 기록용)
    const oldSch = { ...schedules[idx] };
    
    // 변경 사항 적용
    for (let field in modifiedCells[scheduleId]) {
      let value = modifiedCells[scheduleId][field];
      
      // 체크박스 값(unavailable) 처리
      if (field === "unavailable") {
        value = value === true || value === "true";
      }
      
      schedules[idx][field] = value;
    }
    
    // 히스토리 기록
    recordHistory("일괄 수정", currentUid, schedules[idx], oldSch);
    changeCount++;
  }
  
  // Firebase에 변경 내용 저장
  db.ref("schedules").set(schedules)
    .then(() => {
      alert(`${changeCount}개의 일정과 테이블 레이아웃이 성공적으로 저장되었습니다.`);
      modifiedCells = {}; // 변경 내용 초기화
      return loadAllData();
    })
    .then(() => {
      drawScheduleList(); // 목록 다시 그리기
      refreshCalendar(); // 달력 새로고침
    })
    .catch(err => {
      console.error("저장 오류:", err);
      alert(`저장 중 오류가 발생했습니다: ${err.message}`);
    });
}
// 테이블 레이아웃 데이터에서도 변경 필요:
function saveTableLayout() {
  try {
    // 로컬 스토리지에서 열 너비 정보 가져오기
    const columnWidths = JSON.parse(localStorage.getItem('tableColumnWidths') || '{}');
    
    // poNo 필드를 asNo로 변경
    if (columnWidths.poNo !== undefined) {
      columnWidths.asNo = columnWidths.poNo;
      delete columnWidths.poNo;
    }
    
    // 테이블 레이아웃 데이터 생성
    const tableLayout = {
      columnWidths: columnWidths,
      lastUpdate: new Date().toISOString()
    };
    
    // Firebase에 저장
    db.ref("tableLayout").set(tableLayout)
      .then(() => {
        console.log("테이블 레이아웃 저장 완료");
      })
      .catch(err => {
        console.error("테이블 레이아웃 저장 오류:", err);
      });
  } catch (err) {
    console.error("테이블 레이아웃 저장 준비 오류:", err);
  }
}
// 테이블 레이아웃 로드 함수
function loadTableLayout() {
  return db.ref("tableLayout").once("value")
    .then(snap => {
      if (snap.exists()) {
        const layout = snap.val();
        if (layout.columnWidths) {
          window.tableState = window.tableState || {};
          window.tableState.columnWidths = layout.columnWidths;
          
          // 로컬 스토리지에도 저장
          localStorage.setItem('tableColumnWidths', JSON.stringify(layout.columnWidths));
          
          console.log("테이블 레이아웃 로드 완료");
          return true;
        }
      }
      return false;
    })
    .catch(err => {
      console.error("테이블 레이아웃 로드 오류:", err);
      return false;
    });
}


// setupTableResizing 함수 대체 - 테이블 리사이징 개선 버전
function setupTableResizing() {
  const table = document.getElementById('editableScheduleTable');
  const tableContainer = document.getElementById('scheduleTableContainer');
  
  if (!table || !tableContainer) return;
  
  // 초기 테이블 폭 계산 및 적용
  let totalWidth = 0;
  const headers = table.querySelectorAll('th');
  headers.forEach(th => {
    // 저장된 너비 불러오기
    const fieldName = th.getAttribute('data-field');
    let width = 100; // 기본 너비
    
    if (fieldName) {
      try {
        const columnWidths = JSON.parse(localStorage.getItem('tableColumnWidths') || '{}');
        if (columnWidths[fieldName]) {
          width = columnWidths[fieldName];
        }
      } catch (err) {
        console.error('열 너비 로드 오류:', err);
      }
    }
    
    // 필드별 최소 너비 설정
    if (fieldName === 'shipName' || fieldName === 'details' || fieldName === 'message') {
      th.style.minWidth = '200px';
      width = Math.max(width, 200);
    } else {
      th.style.minWidth = '80px';
    }
    
    // 너비 적용
    th.style.width = width + 'px';
    totalWidth += width;
  });
  
  // 전체 테이블 너비 설정
  table.style.width = totalWidth + 'px';
  table.style.minWidth = totalWidth + 'px';
  
  // 각 헤더에 리사이징 핸들러 추가
  headers.forEach(th => {
    // 이미 리사이저가 있으면 제거
    const existingResizers = th.querySelectorAll('.column-resizer');
    existingResizers.forEach(resizer => resizer.remove());
    
    // 새 리사이저 추가
    const resizer = document.createElement('div');
    resizer.className = 'column-resizer';
    
    // 리사이저 스타일
    resizer.style.position = 'absolute';
    resizer.style.top = '0';
    resizer.style.right = '0';
    resizer.style.bottom = '0';
    resizer.style.width = '8px';
    resizer.style.cursor = 'col-resize';
    resizer.style.backgroundColor = 'transparent';
    resizer.style.zIndex = '10';
    
    // 호버 효과
    resizer.addEventListener('mouseover', () => {
      resizer.style.backgroundColor = 'rgba(0, 120, 215, 0.3)';
    });
    resizer.addEventListener('mouseout', () => {
      resizer.style.backgroundColor = 'transparent';
    });
    
    // 리사이징 이벤트
    resizer.addEventListener('mousedown', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // 초기 위치와 너비
      const startX = e.pageX;
      const startWidth = th.offsetWidth;
      const tableStartWidth = table.offsetWidth;
      
      // 스크롤 위치 기억
      const startScrollLeft = tableContainer.scrollLeft;
      
      // 현재 리사이징 중인 열 표시
      resizer.style.backgroundColor = 'rgba(0, 120, 215, 0.5)';
      document.body.style.cursor = 'col-resize';
      
      // 마우스 이동 핸들러
      function onMouseMove(e) {
        // 새 너비 계산 (최소 50px)
        const widthChange = e.pageX - startX;
        const newWidth = Math.max(80, startWidth + widthChange);
        
        // 열 너비 설정
        th.style.width = newWidth + 'px';
        
        // 전체 테이블 너비 업데이트
        const newTableWidth = tableStartWidth + (newWidth - startWidth);
        table.style.width = newTableWidth + 'px';
        
        // 스크롤 위치 조정 (마우스 위치를 따라가도록)
        if (widthChange > 0) {
          tableContainer.scrollLeft = startScrollLeft + widthChange;
        }
      }
      
      // 마우스 업 핸들러
      function onMouseUp() {
        // 마우스 이동/업 이벤트 해제
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        // 커서 및 리사이저 스타일 초기화
        document.body.style.cursor = '';
        resizer.style.backgroundColor = 'transparent';
        
        // 너비 저장
        const fieldName = th.getAttribute('data-field');
        if (fieldName) {
          try {
            const columnWidths = JSON.parse(localStorage.getItem('tableColumnWidths') || '{}');
            columnWidths[fieldName] = th.offsetWidth;
            localStorage.setItem('tableColumnWidths', JSON.stringify(columnWidths));
          } catch (err) {
            console.error('열 너비 저장 오류:', err);
          }
        }
        
        // 테이블 레이아웃 저장
        saveTableLayout();
      }
      
      // 이벤트 리스너 등록
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
    
    // 리사이저를 헤더에 추가
    th.style.position = 'relative';
    th.appendChild(resizer);
  });
}

// 테이블 레이아웃 저장 함수 개선
function saveTableLayout() {
  try {
    // 테이블 전체 너비 및 각 열 너비 저장
    const table = document.getElementById('editableScheduleTable');
    if (!table) return;
    
    // 열 너비 정보 수집
    const columnWidths = {};
    const headers = table.querySelectorAll('th');
    
    headers.forEach(th => {
      const fieldName = th.getAttribute('data-field');
      if (fieldName) {
        columnWidths[fieldName] = th.offsetWidth;
      }
    });
    
    // 로컬 스토리지에 저장
    localStorage.setItem('tableColumnWidths', JSON.stringify(columnWidths));
    
    // Firebase에도 저장
    const tableLayout = {
      columnWidths: columnWidths,
      tableWidth: table.offsetWidth,
      lastUpdate: new Date().toISOString()
    };
    
    db.ref("tableLayout").set(tableLayout)
      .then(() => {
        console.log("테이블 레이아웃 저장 완료");
      })
      .catch(err => {
        console.error("테이블 레이아웃 저장 오류:", err);
      });
  } catch (err) {
    console.error("테이블 레이아웃 저장 준비 오류:", err);
  }
}

// 테이블 레이아웃 로드 함수 개선
function loadTableLayout() {
  return db.ref("tableLayout").once("value")
    .then(snap => {
      if (snap.exists()) {
        const layout = snap.val();
        if (layout.columnWidths) {
          // 로컬 스토리지에 저장
          localStorage.setItem('tableColumnWidths', JSON.stringify(layout.columnWidths));
          
          // 테이블에 레이아웃 적용
          const table = document.getElementById('editableScheduleTable');
          if (table && layout.tableWidth) {
            table.style.width = layout.tableWidth + 'px';
            table.style.minWidth = layout.tableWidth + 'px';
            
            // 각 열에 너비 적용
            const headers = table.querySelectorAll('th');
            headers.forEach(th => {
              const fieldName = th.getAttribute('data-field');
              if (fieldName && layout.columnWidths[fieldName]) {
                th.style.width = layout.columnWidths[fieldName] + 'px';
                th.style.minWidth = layout.columnWidths[fieldName] + 'px';
              }
            });
          }
          
          console.log("테이블 레이아웃 로드 완료");
          return true;
        }
      }
      return false;
    })
    .catch(err => {
      console.error("테이블 레이아웃 로드 오류:", err);
      return false;
    });
}

// 전체화면 모드 토글 함수 개선
function toggleFullscreenTable() {
  const container = document.getElementById('adminScheduleListPane');
  const tableContainer = document.getElementById('scheduleTableContainer');
  const icon = document.getElementById('fullscreenIcon');
  
  if (fullscreenMode) {
    // 전체 화면 종료
    container.classList.remove('fullscreen-table');
    icon.textContent = '⛶';
    fullscreenMode = false;
    
    // 기존 하단 컨트롤 제거
    const existingControls = container.querySelector('.bottom-controls');
    if (existingControls) {
      existingControls.remove();
    }
  } else {
    // 전체 화면 시작
    container.classList.add('fullscreen-table');
    icon.textContent = '⛔';
    fullscreenMode = true;
    
    // 전체화면에서 하단 버튼 영역 추가
    const bottomControls = document.createElement('div');
    bottomControls.className = 'bottom-controls';
    bottomControls.style.position = 'fixed';
    bottomControls.style.bottom = '0';
    bottomControls.style.left = '0';
    bottomControls.style.right = '0';
    bottomControls.style.padding = '10px 20px';
    bottomControls.style.backgroundColor = '#fff';
    bottomControls.style.borderTop = '1px solid #ddd';
    bottomControls.style.textAlign = 'right';
    bottomControls.style.zIndex = '1001';
    
    bottomControls.innerHTML = `
      <button onclick="saveScheduleTable()" class="admin-btn" style="background:#27ae60; margin-right: 10px;">
        💾 변경사항 저장
      </button>
      <button onclick="toggleFullscreenTable()" class="admin-btn">
        ⛔ 전체화면 종료
      </button>
    `;
    
    container.appendChild(bottomControls);
    
    // 테이블 컨테이너 높이 조정 (버튼이 가려지지 않도록)
    if (tableContainer) {
      tableContainer.style.maxHeight = 'calc(100vh - 150px)';
    }
  }
  
  // 리사이징 핸들러 재설정 및 스크롤 초기화
  setTimeout(() => {
    setupTableResizing();
    if (tableContainer) {
      tableContainer.scrollTop = 0;
    }
  }, 100);
}

// 테이블 컨테이너 스타일 동적 설정
function enhanceTableContainer() {
  const tableContainer = document.getElementById('scheduleTableContainer');
  const table = document.getElementById('editableScheduleTable');
  
  if (tableContainer && table) {
    // 컨테이너 스타일 설정
    tableContainer.style.overflowX = 'auto';
    tableContainer.style.width = '100%';
    tableContainer.style.border = '1px solid #ddd';
    tableContainer.style.borderRadius = '4px';
    tableContainer.style.position = 'relative';
    
    // 전체화면 모드에 따른 높이 조정
    if (fullscreenMode) {
      tableContainer.style.maxHeight = 'calc(100vh - 150px)';
    } else {
      tableContainer.style.maxHeight = 'calc(80vh - 200px)';
    }
    
    // 테이블 스타일 설정
    table.style.borderCollapse = 'collapse';
  }
}

// drawScheduleList 함수 끝에 추가할 코드
function applyTableEnhancements() {
  // 컨테이너 스타일 설정
  enhanceTableContainer();
  
  // 테이블 리사이징 설정
  setupTableResizing();
  
  // 추가 스타일 설정 - CSS만으로 해결이 어려운 동적 스타일
  const table = document.getElementById('editableScheduleTable');
  if (table) {
    // 테이블 내 모든 입력 필드 스타일 일관성 유지
    const inputs = table.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.style.width = '100%';
      input.style.padding = '4px';
      input.style.boxSizing = 'border-box';
      input.style.border = '1px solid #ddd';
      input.style.borderRadius = '4px';
    });
    
    // 특정 필드 스타일 조정
    const textareas = table.querySelectorAll('textarea');
    textareas.forEach(textarea => {
      textarea.style.minHeight = '60px';
      textarea.style.resize = 'vertical';
    });
  }
}

// 이 함수를 drawScheduleList 함수 마지막에 호출
// 마지막 줄에 다음을 추가: applyTableEnhancements();



function setDefaultAccessHistoryDates() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  document.getElementById("accessHistoryStartDate").value = formatDate(
    thirtyDaysAgo.getFullYear(),
    thirtyDaysAgo.getMonth() + 1,
    thirtyDaysAgo.getDate()
  );
  
  document.getElementById("accessHistoryEndDate").value = formatDate(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate()
  );
}
// 관리자 페이지 스케줄 목록의 기본 날짜 설정
function setDefaultScheduleQueryDates() {
  const today = new Date();
  const oneMonthLater = new Date(today);
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
  
  document.getElementById("adminQueryStart").value = formatDate(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate()
  );
  
  document.getElementById("adminQueryEnd").value = formatDate(
    oneMonthLater.getFullYear(),
    oneMonthLater.getMonth() + 1,
    oneMonthLater.getDate()
  );
}

// 본사 현황 페이지 스케줄 목록의 기본 날짜 설정
function setDefaultStatusScheduleDates(){
  const today = new Date();
  const oneMonthLater = new Date(today);
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
  
  document.getElementById("statusQueryStart").value = formatDate(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate()
  );
  
  document.getElementById("statusQueryEnd").value = formatDate(
    oneMonthLater.getFullYear(),
    oneMonthLater.getMonth() + 1,
    oneMonthLater.getDate()
  );
}
function openUserEditModal(uid) {
  const user = users[uid];
  if (!user) return;
  
  document.getElementById("userEditUid").value = uid;
  document.getElementById("userEditName").value = user.id || "";
  document.getElementById("userEditEmail").value = user.email || "";
  document.getElementById("userEditRole").value = user.role || "협력";
  document.getElementById("userEditCompany").value = user.company || "";
  
  // 협력 구분 표시 여부 설정
  const subCategoryRow = document.getElementById("userEditSubCategoryRow");
  if (user.role === "협력") {
    subCategoryRow.style.display = "";
    document.getElementById("userEditSubCategory").value = user.subCategory || "기타";
  } else {
    subCategoryRow.style.display = "none";
  }
  
  document.getElementById("modalUserEditBg").style.display = "block";
}

function closeUserEditModal(){
  document.getElementById("modalUserEditBg").style.display = "none";
}

function applyUserEdit(){
  const uid = document.getElementById("userEditUid").value;
  const name = document.getElementById("userEditName").value.trim();
  const role = document.getElementById("userEditRole").value;
  const company = document.getElementById("userEditCompany").value.trim();
  const subCat = document.getElementById("userEditSubCategory").value;
  const data = {
    id: name,
    role: role,
    company: company,
    subCategory: role === "협력" ? subCat : ""
  };
  db.ref("users/"+uid).update(data).then(()=>{
    alert("저장되었습니다.");
    closeUserEditModal();
    return loadAllData();
  }).then(drawUserList);
}

function deleteUserFromModal(){
  const uid = document.getElementById("userEditUid").value;
  if(!confirm("삭제하시겠습니까?")) return;
  db.ref("users/"+uid).remove().then(()=>{
    alert("삭제되었습니다.");
    closeUserEditModal();
    return loadAllData();
  }).then(drawUserList);
}
function populateUserCompanyFilter() {
  const filterSelect = document.getElementById("userCompanyFilter");
  // 기존 선택 값 기억
  const selectedValue = filterSelect.value;
  
  // 필터 초기화
  filterSelect.innerHTML = "<option value=''>전체</option>";
  
  // 고유한 업체 집합 수집
  const companies = new Set();
  
  // users에 있는 모든 업체 수집
  for (const uid in users) {
    const company = users[uid].company;
    if (company && company.trim() !== '') {
      companies.add(company.trim());
    }
  }
  
  // 정렬된 업체 배열로 변환
  const sortedCompanies = Array.from(companies).sort();
  
  // 필터 옵션 추가
  sortedCompanies.forEach(company => {
    const option = document.createElement("option");
    option.value = company;
    option.textContent = company;
    filterSelect.appendChild(option);
  });
  
  // 이전 선택 상태 복원
  if (selectedValue && Array.from(filterSelect.options).some(opt => opt.value === selectedValue)) {
    filterSelect.value = selectedValue;
  }
}

/****************************************
 20) 날짜 포맷 함수
*****************************************/
// 달력 새로고침 함수 (업체 필터링 기능 포함)
function refreshCalendar(){
  if(document.getElementById("monthlySection").classList.contains("active")){
    drawMonthCalendar();
  }
  if(document.getElementById("weeklySection").classList.contains("active")){
    drawWeekCalendar();
  }
  if(document.getElementById("adminScheduleListPane").classList.contains("active")){
    drawScheduleList();
  }
}

function formatDate(y, m, d){
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}
function formatDateForLabel(dateObj){
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth()+1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/****************************************
 21) EmailJS 발송
*****************************************/
function showRecipientSelectPopup(message, callback) {
  const existing = document.getElementById("emailRecipientPopupOverlay");
  if(existing) existing.remove();
  let overlay = document.createElement("div");
  overlay.id = "emailRecipientPopupOverlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgba(0,0,0,0.5)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "10000";
  let popup = document.createElement("div");
  popup.style.backgroundColor = "#fff";
  popup.style.padding = "20px";
  popup.style.borderRadius = "8px";
  popup.style.width = "90%";
  popup.style.maxWidth = "600px";
  popup.style.boxSizing = "border-box";
  popup.style.maxHeight = "80%";
  popup.style.overflowY = "auto";
  let title = document.createElement("h3");
  title.textContent = "메일 발송 수신자 선택";
  popup.appendChild(title);
  let msgPara = document.createElement("p");
  msgPara.innerHTML = "<strong>메시지:</strong><br>" + message.replace(/\n/g, "<br>");
  popup.appendChild(msgPara);
  // 엔지니어 선택 영역
  let engineerContainer = document.createElement("div");
  engineerContainer.id = "emailEngineerContainer";
  engineerContainer.style.marginTop = "15px";
  let engineerLabel = document.createElement("p");
  engineerLabel.textContent = "메일 발송 엔지니어 선택:";
  engineerContainer.appendChild(engineerLabel);
  function addEngineerSelect() {
    let select = document.createElement("select");
    select.style.marginBottom = "5px";
    let emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = "-- 선택 --";
    select.appendChild(emptyOpt);
    for (let uid in users) {
      if(users[uid].role === "협력") {
        if(currentUser && currentUser.role === "협력"){
          if(users[uid].company !== currentUser.company) continue;
        }
        let opt = document.createElement("option");
        opt.value = uid;
        opt.textContent = users[uid].email + " (" + users[uid].id + ")";
        select.appendChild(opt);
      }
    }
    engineerContainer.appendChild(select);
  }
  addEngineerSelect();
  let addEngineerBtn = document.createElement("button");
  addEngineerBtn.textContent = "+";
  addEngineerBtn.style.marginLeft = "10px";
  addEngineerBtn.onclick = addEngineerSelect;
  engineerContainer.appendChild(addEngineerBtn);
  popup.appendChild(engineerContainer);
  // 본사 담당자 선택 영역
  let managerContainer = document.createElement("div");
  managerContainer.id = "emailManagerContainer";
  managerContainer.style.marginTop = "15px";
  let managerLabel = document.createElement("p");
  managerLabel.textContent = "메일 발송 본사 담당자 선택:";
  managerContainer.appendChild(managerLabel);
  function addManagerSelect() {
    let select = document.createElement("select");
    select.style.marginBottom = "5px";
    let emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = "-- 선택 --";
    select.appendChild(emptyOpt);
    for (let uid in users) {
      if(users[uid].role === "본사" || isAdminRole(users[uid].role)){
        let opt = document.createElement("option");
        opt.value = uid;
        opt.textContent = users[uid].email + " (" + users[uid].id + ")";
        select.appendChild(opt);
      }
    }
    managerContainer.appendChild(select);
  }
  addManagerSelect();
  let addManagerBtn = document.createElement("button");
  addManagerBtn.textContent = "+";
  addManagerBtn.style.marginLeft = "10px";
  addManagerBtn.onclick = addManagerSelect;
  managerContainer.appendChild(addManagerBtn);
  popup.appendChild(managerContainer);
  let btnContainer = document.createElement("div");
  btnContainer.style.textAlign = "right";
  btnContainer.style.marginTop = "20px";
  let sendBtn = document.createElement("button");
  sendBtn.textContent = "발송";
  sendBtn.style.marginRight = "10px";
  let cancelBtn = document.createElement("button");
  cancelBtn.textContent = "취소";
  btnContainer.appendChild(sendBtn);
  btnContainer.appendChild(cancelBtn);
  popup.appendChild(btnContainer);
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
  sendBtn.onclick = function() {
    let selectedUIDs = [];
    let engSelects = engineerContainer.querySelectorAll("select");
    engSelects.forEach(function(select) {
      if(select.value.trim() !== ""){
        selectedUIDs.push(select.value);
      }
    });
    let mgrSelects = managerContainer.querySelectorAll("select");
    mgrSelects.forEach(function(select) {
      if(select.value.trim() !== ""){
        selectedUIDs.push(select.value);
      }
    });
    if(selectedUIDs.length === 0){
      alert("최소 한 명 이상의 수신자를 선택하세요.");
      return;
    }
    let selectedRecipients = [];
    selectedUIDs.forEach(function(uid) {
      if(users[uid] && users[uid].email) {
        selectedRecipients.push(users[uid].email);
      }
    });
    document.body.removeChild(overlay);
    callback(selectedRecipients);
  };
  cancelBtn.onclick = function() {
    document.body.removeChild(overlay);
    callback(false);
  };
}
// 이메일 발송 함수 수정 (SHIPOWNER 필드 추가)
function sendEmailNotification(){
  var startDate = document.getElementById("modalStartDate").value;
  var endDate = document.getElementById("modalEndDate").value;
  var imoNo = document.getElementById("modalIMONo").value.trim();
  var shipOwner = document.getElementById("modalShipOwner").value.trim(); // SHIPOWNER 필드 추가
  var shipName = document.getElementById("modalLine").value.trim();
  var hullNo = document.getElementById("modalHullNo").value.trim();
  var regionName = document.getElementById("modalRegion").value.trim();
  var workContent = document.getElementById("modalDetails").value.trim();
  var transferMsg = document.getElementById("modalMessage").value.trim();
  
  // ETA, ETB, ETD 값 가져오기
  var etaVal = document.getElementById("modalETA").value;
  var etbVal = document.getElementById("modalETB").value;
  var etdVal = document.getElementById("modalETD").value;
  
  var engineerNames = "";
  var engineerSelect = document.getElementById("modalUserSelect");
  if(engineerSelect){
    engineerNames = Array.from(engineerSelect.selectedOptions)
                       .map(opt => opt.textContent.trim())
                       .join(", ");
  }
  
  var extraEngineerNames = "";
  var extraContainer = document.getElementById("additionalEngineerRows");
  if(extraContainer){
    extraEngineerNames = Array.from(extraContainer.querySelectorAll("select"))
                             .map(sel => {
                                return Array.from(sel.selectedOptions)
                                           .map(opt => opt.textContent.trim())
                                           .join(", ");
                             })
                             .join(", ");
  }
  
  var allEngineerNames = engineerNames;
  if(extraEngineerNames){
    allEngineerNames = allEngineerNames ? (allEngineerNames + ", " + extraEngineerNames) : extraEngineerNames;
  }
  var managerNames = "";
  var managerSelect = document.getElementById("modalManagerSelect");
  if(managerSelect){
    managerNames = Array.from(managerSelect.selectedOptions)
                     .map(opt => opt.textContent.trim())
                     .join(", ");
  }
  
  var msg = "";
  msg += "엔지니어: " + (allEngineerNames || "미지정") + "\n";
  msg += "본사 담당자: " + (managerNames || "미지정") + "\n";
  msg += "시작일: " + startDate + "\n";
  msg += "종료일: " + endDate + "\n";
  msg += "IMO No.: " + imoNo + "\n";
  msg += "SHIPOWNER: " + shipOwner + "\n"; // SHIPOWNER 필드 추가
  msg += "Ship Name: " + shipName + "\n";
  msg += "Hull No.: " + hullNo + "\n";
  msg += "지역: " + regionName + "\n";
  msg += "ETA: " + etaVal + "\n";
  msg += "ETB: " + etbVal + "\n";
  msg += "ETD: " + etdVal + "\n";
  msg += "작업내용: " + workContent + "\n";
  msg += "전달사항: " + transferMsg;
  
  
  showRecipientSelectPopup(msg, function(selectedRecipients){
    if(selectedRecipients === false){
      alert("이메일 발송이 취소되었습니다.");
      return;
    }
    
    // 디버깅 로그 추가
    console.log("선택된 수신자:", selectedRecipients);
    
    // 수신자가 없는 경우 처리
    if(!selectedRecipients || selectedRecipients.length === 0){
      alert("최소 한 명 이상의 수신자를 선택하세요.");
      return;
    }
    
    // 발신자 이메일 설정
    var fromEmail = (currentUser && currentUser.email) ? currentUser.email : "noreply@example.com";
    
    
    // 각 이메일 주소로 개별 전송 (동시에 전송)
    Promise.all(selectedRecipients.map(function(email){
      return emailjs.send("service_cvipu3z", "template_aneojps", { 
         to_email: email,
         from_email: fromEmail,
         message: msg
      });
    }))
    .then(function(responses){
      console.log("이메일 전송 성공:", responses);
      alert("모든 이메일이 전송되었습니다.");
    })
    .catch(function(error){
      console.error("이메일 전송 실패:", error);
      alert("이메일 전송에 실패했습니다: " + (error.text || error.message || "알 수 없는 오류"));
    });
  });
}/****************************************
 22) 타임 테이블 모달 관련 기능
*****************************************/
function openTimeTableModal(){
  db.ref("timeTable").once("value").then(snap => {
    if(snap.exists()){
      timeTableData = [];
      snap.forEach(child => { timeTableData.push(child.val()); });
    } else { timeTableData = []; }
    renderTimeTable();
    document.getElementById("timeTableModalBg").style.display = "block";
  });
}
function closeTimeTableModal(){
  document.getElementById("timeTableModalBg").style.display = "none";
}
function renderTimeTable(){
  const tbody = document.getElementById("timeTableBody");
  tbody.innerHTML = "";
  timeTableData.forEach((row, index) => {
    const tr = document.createElement("tr");
    const tdTime = document.createElement("td");
    const inputTime = document.createElement("input");
    inputTime.type = "text";
    inputTime.value = row.time || "";
    tdTime.appendChild(inputTime);
    const tdWork = document.createElement("td");
    const inputWork = document.createElement("input");
    inputWork.type = "text";
    inputWork.value = row.work || "";
    tdWork.appendChild(inputWork);
    const tdDelete = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.textContent = "삭제";
    delBtn.onclick = function(){ timeTableData.splice(index, 1); renderTimeTable(); };
    tdDelete.appendChild(delBtn);
    tr.appendChild(tdTime);
    tr.appendChild(tdWork);
    tr.appendChild(tdDelete);
    tbody.appendChild(tr);
  });
}
function addTimeTableRow(){
  timeTableData.push({ time:"", work:"" });
  renderTimeTable();
}
function saveTimeTable(){
  const tbody = document.getElementById("timeTableBody");
  const newData = [];
  tbody.querySelectorAll("tr").forEach(row => {
    const inputs = row.querySelectorAll("input");
    newData.push({ time: inputs[0].value, work: inputs[1].value });
  });
  timeTableData = newData;
  db.ref("timeTable").set(timeTableData).then(() => {
    alert("타임 테이블 저장 완료");
    closeTimeTableModal();
  });
}
function downloadTimeTableExcel(){
  const ws = XLSX.utils.json_to_sheet(timeTableData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "TimeTable");
  XLSX.writeFile(wb, "timeTable.xlsx");
}
function uploadTimeTableExcel(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, {type:"array"});
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(ws);
    timeTableData = jsonData;
    renderTimeTable();
  };
  reader.readAsArrayBuffer(file);
}

/****************************************
 유저 등록/수정 관련 추가 함수 (협력 구분)
*****************************************/
function toggleRegisterSubCategory() {
  var role = document.getElementById("adminRegisterRole").value;
  var row = document.getElementById("adminRegisterSubCategoryRow");
  if(role === "협력") {
    row.style.display = "";
  } else {
    row.style.display = "none";
  }
}

function createUser(){
  const role = document.getElementById("adminRegisterRole").value;
  const subCat = document.getElementById("adminRegisterSubCategory").value;
  const name = document.getElementById("adminRegisterName").value.trim();
  const email = document.getElementById("adminRegisterEmail").value.trim();
  const pw = document.getElementById("adminRegisterPw").value;
  const company = document.getElementById("adminRegisterCompany").value.trim();
  if(!email || !pw){ alert("이메일과 비밀번호를 입력하세요."); return; }
  fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`,
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,password:pw,returnSecureToken:true})})
    .then(res=>res.json())
    .then(data=>{
      if(data.error) throw new Error(data.error.message);
      const uid = data.localId;
      return db.ref('users/'+uid).set({
        id:name,
        email:email,
        role:role,
        company:company,
        subCategory: role === '협력' ? subCat : ''
      });
    })
    .then(()=>{ alert('유저 등록 완료'); return loadAllData(); })
    .then(drawUserList)
    .catch(err=>alert('등록 실패: '+err.message));
}

/****************************************
 스케줄 등록/수정 모달 관련: '기타 협력사 포함' 체크박스 제어
*****************************************/
// openModal 함수 내에서 이미 처리 (본사/관리자일 때 includeOtherPartnersRow 표시)

/****************************************
 15) 가용 엔지니어 업데이트 함수 수정 (주요/기타 협력사 필터)
*****************************************/
function updateAvailableEngineers(sDate, eDate){
  const listDiv = document.getElementById("availableEngineersList");
  if(!sDate || !eDate){
    listDiv.textContent = "시작/종료일을 먼저 입력하세요.";
    return;
  }
  let includeOther = false;
  const checkbox = document.getElementById("includeOtherPartnersCheckbox");
  if(checkbox) { includeOther = checkbox.checked; }
  const available = [];
  for(const uid in users){
    if(users[uid].role === "협력"){
      // 협력 사용자는 본인 회사의 협력자만 보임
      if(currentUser.role === "협력" && users[uid].company !== currentUser.company) continue;
      let subCategory = users[uid].subCategory || "기타";
      if(subCategory !== "주요" && !includeOther) continue;
      const conflict = schedules.some(sch => {
         if(sch.userId !== uid) return false;
         if(sch.status === "cancelled") return false;
         return (sch.startDate <= eDate && sch.endDate >= sDate);
      });
      if(!conflict) available.push(uid);
    }
  }
  if(available.length < 1){
    listDiv.textContent = "가용 엔지니어 없음";
  } else {
    listDiv.textContent = available.map(uid => users[uid].id + " (" + (users[uid].company || "업체 미지정") + ")").join(", ");
  }
}



/****************************************
 22) 아래는 본사 전용 현황 페이지용 함수들
     - 유저 목록, 스케줄 목록, 변경 히스토리 표시 (읽기 전용)
*****************************************/
function drawStatusUserList(){
  populateStatusUserFilter();
  const filterSelect = document.getElementById("statusUserCompanyFilter");
  const selectedCompany = filterSelect.value;
  const tbody = document.getElementById("statusUserListBody");
  tbody.innerHTML = "";
  let userArray = [];
  for(const uid in users){
    userArray.push({ uid: uid, user: users[uid] });
  }
  userArray.sort((a,b) => {
    let compA = a.user.company ? a.user.company.toLowerCase() : "";
    let compB = b.user.company ? b.user.company.toLowerCase() : "";
    if(compA < compB) return -1;
    if(compA > compB) return 1;
    return 0;
  });
  userArray.forEach(item => {
    if(selectedCompany && item.user.company !== selectedCompany) return;
    let tr = document.createElement("tr");
    let tdName = document.createElement("td");
    tdName.textContent = item.user.id || "";
    let tdEmail = document.createElement("td");
    tdEmail.textContent = item.user.email || "";
    let tdRole = document.createElement("td");
    tdRole.textContent = item.user.role;
    let tdSub = document.createElement("td");
    tdSub.textContent = (item.user.role === "협력" ? (item.user.subCategory || "기타") : "");
    let tdComp = document.createElement("td");
    tdComp.textContent = item.user.company || "";
    tr.appendChild(tdName);
    tr.appendChild(tdEmail);
    tr.appendChild(tdRole);
    tr.appendChild(tdSub);
    tr.appendChild(tdComp);
    tbody.appendChild(tr);
  });
}
function populateStatusUserFilter() {
  const filterSelect = document.getElementById("statusUserCompanyFilter");
  // 기존 선택 값 기억
  const selectedValue = filterSelect.value;
  
  // 필터 초기화
  filterSelect.innerHTML = "<option value=''>전체</option>";
  
  // 고유한 업체 집합 수집
  const companies = new Set();
  
  // users에 있는 모든 업체 수집
  for (const uid in users) {
    const company = users[uid].company;
    if (company && company.trim() !== '') {
      companies.add(company.trim());
    }
  }
  
  // 정렬된 업체 배열로 변환
  const sortedCompanies = Array.from(companies).sort();
  
  // 필터 옵션 추가
  sortedCompanies.forEach(company => {
    const option = document.createElement("option");
    option.value = company;
    option.textContent = company;
    filterSelect.appendChild(option);
  });
  
  // 이전 선택 상태 복원
  if (selectedValue && Array.from(filterSelect.options).some(opt => opt.value === selectedValue)) {
    filterSelect.value = selectedValue;
  }
}

function drawUserList() {
  // 사용자 목록 컨테이너 가져오기
  const tbody = document.getElementById("adminUserListBody");
  tbody.innerHTML = "";
  
  // 업체별 필터 적용
  const filterCompany = document.getElementById("userCompanyFilter").value;
  
  // 사용자 배열 생성 및 정렬 (업체명 기준)
  let userArray = [];
  for (const uid in users) {
    userArray.push({ uid: uid, user: users[uid] });
  }
  userArray.sort((a, b) => {
    let compA = a.user.company ? a.user.company.toLowerCase() : "";
    let compB = b.user.company ? b.user.company.toLowerCase() : "";
    return compA.localeCompare(compB);
  });
  
  // 사용자 목록 표시
  userArray.forEach(item => {
    // 업체별 필터 적용
    if (filterCompany && item.user.company !== filterCompany) return;
    
    const tr = document.createElement("tr");
    
    // 이름
    const tdName = document.createElement("td");
    tdName.textContent = item.user.id || "(이름 없음)";
    tr.appendChild(tdName);
    
    // 이메일
    const tdEmail = document.createElement("td");
    tdEmail.textContent = item.user.email || "";
    tr.appendChild(tdEmail);
    
    // 권한
    const tdRole = document.createElement("td");
    tdRole.textContent = item.user.role || "";
    tr.appendChild(tdRole);
    
    // 협력 구분
    const tdSubCategory = document.createElement("td");
    tdSubCategory.textContent = (item.user.role === "협력") ? (item.user.subCategory || "기타") : "";
    tr.appendChild(tdSubCategory);
    
    // 업체
    const tdCompany = document.createElement("td");
    tdCompany.textContent = item.user.company || "";
    tr.appendChild(tdCompany);
    
    // 수정 버튼
    const tdEdit = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.className = "admin-btn";
    editBtn.textContent = "수정";
    editBtn.onclick = () => openUserEditModal(item.uid);
    tdEdit.appendChild(editBtn);
    tr.appendChild(tdEdit);
    
    // 삭제 버튼
    const tdDelete = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "admin-btn";
    delBtn.textContent = "삭제";
    delBtn.onclick = () => deleteUser(item.uid);
    tdDelete.appendChild(delBtn);
    tr.appendChild(tdDelete);
    
    tbody.appendChild(tr);
  });
}


// 스케줄 목록 렌더링 (기간 설정 적용, 읽기 전용)
function drawStatusScheduleList(){
  const qStart = document.getElementById("statusQueryStart").value;
  const qEnd = document.getElementById("statusQueryEnd").value;
  const tbody = document.getElementById("statusScheduleListBody");
  tbody.innerHTML = "";
  
  // 시작일 기준으로 필터링
  const filtered = schedules.filter(sch => 
    (!qStart || sch.startDate >= qStart) && 
    (!qEnd || sch.startDate <= qEnd)
  );
  
  // 시작일 기준으로 정렬
  filtered.sort((a, b) => a.startDate.localeCompare(b.startDate));
  
  filtered.forEach(sch => {
      const tr = document.createElement("tr");
      const tdCompany = document.createElement("td");
      const userObj = users[sch.userId] || {};
      tdCompany.textContent = userObj.company || "(업체 미지정)";
      tr.appendChild(tdCompany);
      const tdEngineer = document.createElement("td");
      tdEngineer.textContent = userObj.id || "";
      tr.appendChild(tdEngineer);
      const tdPeriod = document.createElement("td");
      tdPeriod.textContent = `${sch.startDate} ~ ${sch.endDate}`;
      tr.appendChild(tdPeriod);
      const tdShipName = document.createElement("td");
      tdShipName.textContent = sch.lineName || "";
      tr.appendChild(tdShipName);
      const tdIMONo = document.createElement("td");
      tdIMONo.textContent = sch.imoNo || "";
      tr.appendChild(tdIMONo);
      const tdHullNo = document.createElement("td");
      tdHullNo.textContent = sch.hullNo || "";
      tr.appendChild(tdHullNo);
      const tdRegion = document.createElement("td");
      tdRegion.textContent = sch.regionName || "";
      tr.appendChild(tdRegion);
      const tdManager = document.createElement("td");
      if(sch.managerId && users[sch.managerId]){
         tdManager.textContent = users[sch.managerId].id || "";
      } else { tdManager.textContent = ""; }
      tr.appendChild(tdManager);
      const tdDetails = document.createElement("td");
      tdDetails.textContent = sch.details || "";
      tr.appendChild(tdDetails);
      const tdUnavailable = document.createElement("td");
      tdUnavailable.style.textAlign = "left";
      tdUnavailable.textContent = sch.unavailable ? "서비스 불가" : "";
      tr.appendChild(tdUnavailable);
      tbody.appendChild(tr);
  });
}
function setDefaultStatusScheduleDates(){
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth()+1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;
  document.getElementById("statusQueryStart").value = todayStr;
  
  const oneMonthLater = new Date(today);
  oneMonthLater.setMonth(oneMonthLater.getMonth()+1);
  const yyyy2 = oneMonthLater.getFullYear();
  const mm2 = String(oneMonthLater.getMonth()+1).padStart(2, "0");
  const dd2 = String(oneMonthLater.getDate()).padStart(2, "0");
  const oneMonthLaterStr = `${yyyy2}-${mm2}-${dd2}`;
  document.getElementById("statusQueryEnd").value = oneMonthLaterStr;
}

// 변경 히스토리 렌더링 (기존 drawStatusHistory() 그대로 사용)
function drawStatusHistory(){
  const tbody = document.getElementById("statusHistoryBody");
  tbody.innerHTML = "";
  
  // 컨테이너에 좌우 스크롤 적용
  const container = document.getElementById("statusHistoryPane");
  container.style.overflowX = "auto";
  
  const table = tbody.closest('table');
  table.style.minWidth = "1200px"; // 최소 너비 설정
  
  const sorted = [...histories].sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  sorted.forEach(h => {
    const tr = document.createElement("tr");
    
    // 1. 시간 정보
    const tdTime = document.createElement("td");
    tdTime.style.width = "80px";
    tdTime.textContent = (h.timestamp || "").replace("T", " ").substring(0,19);
    tr.appendChild(tdTime);
    
    // 2. 사용자 정보
    const tdUser = document.createElement("td");
    tdUser.textContent = h.user || "";
    tr.appendChild(tdUser);
    
    // 3. 변경 전 시작일/종료일
    const tdOldStart = document.createElement("td");
    tdOldStart.textContent = h.oldStartDate || "";
    tr.appendChild(tdOldStart);
    
    const tdOldEnd = document.createElement("td");
    tdOldEnd.textContent = h.oldEndDate || "";
    tr.appendChild(tdOldEnd);
    
    // 4. 변경 후 시작일/종료일
    const tdNewStart = document.createElement("td");
    tdNewStart.textContent = h.newStartDate || "";
    tr.appendChild(tdNewStart);
    
    const tdNewEnd = document.createElement("td");
    tdNewEnd.textContent = h.newEndDate || "";
    tr.appendChild(tdNewEnd);
    
    // 5. 구분
    const tdAct = document.createElement("td");
    tdAct.textContent = h.action || "";
    tr.appendChild(tdAct);
    
    // 6. 추가 데이터들 (IMO, Ship Name, Hull No, 지역, 상세 등)
    // 업체
    const tdCompany = document.createElement("td");
    tdCompany.textContent = h.업체 || "";
    tr.appendChild(tdCompany);
    
    // 엔지니어
    const tdEngineer = document.createElement("td");
    tdEngineer.textContent = h.엔지니어 || "";
    tr.appendChild(tdEngineer);
    
    // Ship Name (변경 전/후)
    const tdOldShipName = document.createElement("td");
    tdOldShipName.textContent = h.oldShipName || "";
    tr.appendChild(tdOldShipName);
    
    const tdNewShipName = document.createElement("td");
    tdNewShipName.textContent = h.newShipName || "";
    tr.appendChild(tdNewShipName);
    
    // IMO No (변경 전/후)
    const tdOldIMO = document.createElement("td");
    tdOldIMO.textContent = h.oldIMO || "";
    tr.appendChild(tdOldIMO);
    
    const tdNewIMO = document.createElement("td");
    tdNewIMO.textContent = h.newIMO || "";
    tr.appendChild(tdNewIMO);
    
    // Hull No (변경 전/후)
    const tdOldHull = document.createElement("td");
    tdOldHull.textContent = h.oldHull || "";
    tr.appendChild(tdOldHull);
    
    const tdNewHull = document.createElement("td");
    tdNewHull.textContent = h.newHull || "";
    tr.appendChild(tdNewHull);
    
    // 지역 (변경 전/후)
    const tdOldRegion = document.createElement("td");
    tdOldRegion.textContent = h.oldRegion || "";
    tr.appendChild(tdOldRegion);
    
    const tdNewRegion = document.createElement("td");
    tdNewRegion.textContent = h.newRegion || "";
    tr.appendChild(tdNewRegion);
    
    // 담당자
    const tdManager = document.createElement("td");
    tdManager.textContent = h.담당자 || "";
    tr.appendChild(tdManager);
    
    tbody.appendChild(tr);
  });
}

function drawStatusPage(){
  drawStatusUserList();
  drawStatusScheduleList();
  drawStatusHistory();
}
// 담당자 필터 옵션을 채우는 함수
function populateManagerFilters() {
  // 월간 달력 필터
  const monthFilter = document.getElementById("monthManagerFilter");
  // 주간 달력 필터
  const weekFilter = document.getElementById("weekManagerFilter");
  
  // 기존 선택값 기억
  const monthSelectedValue = monthFilter.value;
  const weekSelectedValue = weekFilter.value;
  
  // 필터 초기화
  monthFilter.innerHTML = "<option value=''>전체</option>";
  weekFilter.innerHTML = "<option value=''>전체</option>";
  
  // 본사 담당자 사용자 수집
  const managers = [];
  
  for (const uid in users) {
    // 본사 또는 관리자 권한을 가진 사용자만 추가
    if (users[uid].role === "본사" || isAdminRole(users[uid].role)) {
      managers.push({
        uid: uid,
        name: users[uid].id || "(이름 없음)",
        email: users[uid].email || ""
      });
    }
  }
  
  // 이름 기준으로 정렬
  managers.sort((a, b) => a.name.localeCompare(b.name));
  
  // 필터 옵션 추가
  managers.forEach(manager => {
    // 월간 달력 필터에 추가
    const monthOption = document.createElement("option");
    monthOption.value = manager.uid;
    monthOption.textContent = manager.name;
    monthFilter.appendChild(monthOption);
    
    // 주간 달력 필터에 추가
    const weekOption = document.createElement("option");
    weekOption.value = manager.uid;
    weekOption.textContent = manager.name;
    weekFilter.appendChild(weekOption);
  });
  
  // 이전 선택 상태 복원
  if (monthSelectedValue && Array.from(monthFilter.options).some(opt => opt.value === monthSelectedValue)) {
    monthFilter.value = monthSelectedValue;
  }
  
  if (weekSelectedValue && Array.from(weekFilter.options).some(opt => opt.value === weekSelectedValue)) {
    weekFilter.value = weekSelectedValue;
  }
}

// IMO 번호로 AS 데이터베이스에서 선박 정보 조회 함수
async function fetchShipDataFromAsDatabase(imoNumber) {
  try {
    const snapshot = await db.ref("as-service/data").once('value');
    const asData = snapshot.val() || {};
    
    // IMO 번호로 선박 찾기
    for (const key in asData) {
      const ship = asData[key];
      if (ship.imo && ship.imo.toString().trim() === imoNumber.toString().trim()) {
        return {
          shipName: ship.shipName || '',
          shipowner: ship.shipowner || '',
          hull: ship.hull || ''
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('AS 데이터베이스 조회 오류:', error);
    return null;
  }
}

// IMO 입력 필드 변경 이벤트 핸들러
async function handleImoChange(e) {
  const imoValue = e.target.value.trim();
  
  if (!imoValue) return;
  
  // AS 데이터베이스에서 선박 정보 조회
  const shipData = await fetchShipDataFromAsDatabase(imoValue);
  
  if (shipData) {
    // 선박명 자동 입력
    const shipNameInput = document.getElementById("modalLine");
    if (shipNameInput && !shipNameInput.value.trim()) {
      shipNameInput.value = shipData.shipName;
    }
    
    // 선주사 자동 입력
    const shipOwnerInput = document.getElementById("modalShipOwner");
    if (shipOwnerInput && !shipOwnerInput.value.trim()) {
      shipOwnerInput.value = shipData.shipowner;
    }
    
    // Hull No. 자동 입력
    const hullInput = document.getElementById("modalHullNo");
    if (hullInput && !hullInput.value.trim()) {
      hullInput.value = shipData.hull;
    }
    
    console.log(`IMO ${imoValue}에 대한 선박 정보 자동 입력 완료:`, shipData);
  } else {
    console.log(`IMO ${imoValue}에 대한 선박 정보를 찾을 수 없습니다.`);
  }
}


/****************************************
 1) 엑셀 시리얼 날짜 변환 함수 (수정됨)
*****************************************/
// 날짜 파싱 함수
function parseExcelDate(cellValue) {
  if (!cellValue) return "";
  if (typeof cellValue === "number") {
    var d = new Date(1899, 11, 31);
    d.setDate(d.getDate() + cellValue);
    return d.toISOString().substring(0, 10);
  }
  if (typeof cellValue === "string") {
    var tryDate = new Date(cellValue);
    if (!isNaN(tryDate.getTime())) {
      return tryDate.toISOString().substring(0, 10);
    } else {
      return cellValue.substring(0, 10);
    }
  }
  return "";
}
// 현황 메뉴 전환 (기존 showStatusPane()와 동일)
function showStatusPane(type){
   // 모든 판 숨김
   document.getElementById("statusUserPane").style.display = "none";
   document.getElementById("statusSchedulePane").style.display = "none";
   document.getElementById("statusHistoryPane").style.display = "none";
   // 버튼 active 제거
   document.getElementById("btnStatusUser").classList.remove("active");
   document.getElementById("btnStatusSchedule").classList.remove("active");
   document.getElementById("btnStatusHistory").classList.remove("active");
   if(type === "user"){
      document.getElementById("statusUserPane").style.display = "block";
      document.getElementById("btnStatusUser").classList.add("active");
      drawStatusUserList();
   } else if(type === "schedule"){
      document.getElementById("statusSchedulePane").style.display = "block";
      document.getElementById("btnStatusSchedule").classList.add("active");
    setDefaultStatusScheduleDates(); // 기본 날짜 설정 추가
      drawStatusScheduleList();
   } else if(type === "history"){
      document.getElementById("statusHistoryPane").style.display = "block";
      document.getElementById("btnStatusHistory").classList.add("active");
      drawStatusHistory();
   }
}


// Ship Name 셀 생성 함수
function createShipNameCell(sch, tr) {
  const shipNameCell = document.createElement("td");
  shipNameCell.setAttribute("contenteditable", "true");
  shipNameCell.setAttribute("data-field", "lineName");
  shipNameCell.textContent = sch.lineName || "";
  shipNameCell.setAttribute("data-original", sch.lineName || "");
  
  // 셀 속성 설정 - 더 넓은 폭과 스크롤
  shipNameCell.style.minWidth = "200px";
  shipNameCell.style.maxWidth = "600px"; 
  shipNameCell.style.width = "300px";
  shipNameCell.style.maxHeight = "100px";
  shipNameCell.style.overflowY = "auto";
  shipNameCell.style.whiteSpace = "pre-wrap";
  shipNameCell.style.wordBreak = "break-word";
  
  shipNameCell.onblur = function() {
    trackChange(this);
  };
  
  // 데이터 필드 속성 추가
  shipNameCell.setAttribute("data-field", "lineName");
  
  tr.appendChild(shipNameCell);
  return shipNameCell;
}
// 상세 내용 셀 생성 함수
function createDetailsCell(sch, tr) {
  const detailsCell = document.createElement("td");
  detailsCell.setAttribute("contenteditable", "true");
  detailsCell.setAttribute("data-field", "details");
  detailsCell.textContent = sch.details || "";
  detailsCell.setAttribute("data-original", sch.details || "");
  
  // 셀 속성 설정 - 더 넓은 폭과 스크롤
  detailsCell.style.minWidth = "200px";
  detailsCell.style.maxWidth = "600px"; 
  detailsCell.style.width = "300px";
  detailsCell.style.maxHeight = "100px";
  detailsCell.style.overflowY = "auto";
  detailsCell.style.whiteSpace = "pre-wrap";
  detailsCell.style.wordBreak = "break-word";
  
  detailsCell.onblur = function() {
    trackChange(this);
  };
  
  tr.appendChild(detailsCell);
  return detailsCell;
}

// 전달사항 셀 생성 함수
function createMessageCell(sch, tr) {
  const messageCell = document.createElement("td");
  messageCell.setAttribute("contenteditable", "true");
  messageCell.setAttribute("data-field", "message");
  messageCell.textContent = sch.message || "";
  messageCell.setAttribute("data-original", sch.message || "");
  
  // 셀 속성 설정 - 더 넓은 폭과 스크롤
  messageCell.style.minWidth = "200px";
  messageCell.style.maxWidth = "600px"; 
  messageCell.style.width = "300px";
  messageCell.style.maxHeight = "100px";
  messageCell.style.overflowY = "auto";
  messageCell.style.whiteSpace = "pre-wrap";
  messageCell.style.wordBreak = "break-word";
  
  messageCell.onblur = function() {
    trackChange(this);
  };
  
  tr.appendChild(messageCell);
  return messageCell;
}
// 스크롤 가능한 편집 셀 생성 함수들

// 기본 편집 가능한 셀 생성 함수
function createEditableCell(sch, fieldName, tr, displayWidth = false) {
  const cell = document.createElement("td");
  
  // 스크롤 가능한 컨테이너 생성
  const container = document.createElement("div");
  container.className = "scrollable-cell-container";
  container.setAttribute("contenteditable", "true");
  container.setAttribute("data-field", fieldName);
  container.textContent = sch[fieldName] || "";
  container.setAttribute("data-original", sch[fieldName] || "");
  
  // 이벤트 핸들러 추가
  container.onblur = function() {
    trackChange(this);
  };
  
  // 넓은 필드일 경우 추가 스타일 적용
  if (displayWidth) {
    container.style.minWidth = "200px";
    container.style.maxWidth = "600px";
    container.style.width = "300px";
  }
  
  cell.appendChild(container);
  cell.setAttribute("data-field", fieldName);
  
  return cell;
}

// Ship Name 셀 생성 함수
function createShipNameCell(sch, tr) {
  const cell = createEditableCell(sch, "lineName", tr, true);
  return cell;
}

// 상세 내용 셀 생성 함수
function createDetailsCell(sch, tr) {
  const cell = createEditableCell(sch, "details", tr, true);
  return cell;
}

// 전달사항 셀 생성 함수
function createMessageCell(sch, tr) {
  const cell = createEditableCell(sch, "message", tr, true);
  return cell;
}

// 취소 사유 셀 생성 함수
function createCancelReasonCell(sch, tr) {
  const cell = createEditableCell(sch, "cancelReason", tr, false);
  return cell;
}

// 국가 셀 생성 함수
function createCountryCell(sch, tr) {
  const cell = createEditableCell(sch, "country", tr, false);
  return cell;
}

// 지역 셀 생성 함수
function createRegionCell(sch, tr) {
  const cell = createEditableCell(sch, "regionName", tr, false);
  return cell;
}

// IMO 번호 셀 생성 함수
function createImoCell(sch, tr) {
  const cell = createEditableCell(sch, "imoNo", tr, false);
  return cell;
}

// Hull 번호 셀 생성 함수
function createHullCell(sch, tr) {
  const cell = createEditableCell(sch, "hullNo", tr, false);
  return cell;
}

// PO 번호 셀 생성 함수
function createAsNoCell(sch, tr) {
  const cell = createEditableCell(sch, "asNo", tr, false);
  return cell;
}

// main.js 파일에 새로 추가할 함수

// 단순 저장 기능 (상태 변경 없이 입력값만 저장)
function saveScheduleOnly() {
  const sDate = document.getElementById("modalStartDate").value;
  const eDate = document.getElementById("modalEndDate").value;
  const imoNo = document.getElementById("modalIMONo").value.trim();
  const shipOwner = document.getElementById("modalShipOwner").value.trim();
  const shipName = document.getElementById("modalLine").value.trim();
  const hullNo = document.getElementById("modalHullNo").value.trim();
  const regionVal = document.getElementById("modalRegion").value.trim();
  const workContent = document.getElementById("modalDetails").value.trim();
  const transferMsg = document.getElementById("modalMessage").value.trim();
  const isUnavailable = document.getElementById("modalUnavailable").checked;

 // AS No. 값 가져오기 추가
  const asNoVal = document.getElementById("modalAsNo").value.trim();
  const asTypeVal = document.getElementById("modalAsType").value;
  
  // 국가 값 가져오기 추가
  const countryVal = document.getElementById("modalCountry").value.trim();  


  // ETA, ETB, ETD 값 가져오기
  const etaVal = document.getElementById("modalETA").value;
  const etbVal = document.getElementById("modalETB").value;
  const etdVal = document.getElementById("modalETD").value;
  
  if(!sDate || !eDate){ 
    alert("시작/종료일을 입력하세요"); 
    return; 
  }
  
  if(sDate > eDate){ 
    alert("종료일이 시작일보다 빠릅니다."); 
    return; 
  }
  
  let mainUserId;
  if(document.getElementById("modalUserRow").style.display !== "none"){
    mainUserId = document.getElementById("modalUserSelect").value;
  } else if(editingScheduleId){
    const idxKeep = schedules.findIndex(x => x.id === editingScheduleId);
    mainUserId = idxKeep > -1 ? schedules[idxKeep].userId : currentUid;
  } else {
    mainUserId = currentUid;
  }
  
  const extraContainer = document.getElementById("additionalEngineerRows");
  const extraSelects = extraContainer.querySelectorAll("select");
  
  const managerId = isUnavailable ? '' : document.getElementById("modalManagerSelect").value;
  
  if(editingScheduleId) {
    const idx = schedules.findIndex(x => x.id === editingScheduleId);
    if(idx > -1) {
      if(!canAccessSchedule(schedules[idx])){ 
        alert("수정 권한 없음"); 
        return; 
      }
      
      const oldSch = { ...schedules[idx] };
      
      // 기존 상태 유지 (상태 변경없이 데이터만 업데이트)
      const currentStatus = schedules[idx].status || "일정 등록";
      
      schedules[idx].userId = mainUserId;
      schedules[idx].startDate = sDate;
      schedules[idx].endDate = eDate;
      schedules[idx].imoNo = imoNo;
      schedules[idx].shipOwner = shipOwner;
      schedules[idx].lineName = shipName;
      schedules[idx].hullNo = hullNo;
      schedules[idx].regionName = regionVal;
      schedules[idx].details = workContent;
      schedules[idx].message = transferMsg;
      schedules[idx].unavailable = isUnavailable;
      schedules[idx].managerId = managerId;

    
      // AS No. 저장 추가
      schedules[idx].asNo = asNoVal;
      // AS 구분 저장 추가
      schedules[idx].asType = asTypeVal;
      
      // 국가 저장 추가
      schedules[idx].country = countryVal;
      
      // ETA, ETB, ETD 추가
      schedules[idx].eta = etaVal;
      schedules[idx].etb = etbVal;
      schedules[idx].etd = etdVal;
      
      // 상태 유지 (단순 저장이므로 상태 변경 없음)
      schedules[idx].status = currentStatus;
      
      // 추가 엔지니어 처리는 기존과 동일하게 유지
      extraSelects.forEach(sel => {
        const uid = sel.value;
        if(uid){
          const newId = Date.now() + Math.floor(Math.random() * 100000);
          schedules.push({
            id: newId,
            userId: uid,
            startDate: sDate,
            endDate: eDate,
            imoNo: imoNo,
            shipOwner: shipOwner,
            lineName: shipName,
            hullNo: hullNo,
            regionName: regionVal,
            details: workContent,
            message: transferMsg,
            unavailable: isUnavailable,
            managerId: managerId,
            asNo: asNoVal,      // AS No. 추가
            asType: asTypeVal,  // AS 구분 추가
            country: countryVal, // 국가 추가
            eta: etaVal,
            etb: etbVal,
            etd: etdVal,
            status: currentStatus // 동일한 상태 적용
          });
        }
      });
      
      db.ref("schedules").set(schedules).then(() => { 
        return loadAllData(); 
      })
      .then(() => {
        recordHistory("단순 저장", currentUid, schedules[idx], oldSch);
        alert("데이터가 저장되었습니다.");
        closeModal();
        refreshCalendar();
      })
      .catch(err => {
        console.error("저장 오류:", err);
        alert("저장 중 오류가 발생했습니다: " + err.message);
      });
    }
  } else {
    // 신규 등록 시
    const newId = Date.now();
    const newSch = {
      id: newId,
      userId: mainUserId,
      startDate: sDate,
      endDate: eDate,
      imoNo: imoNo,
      shipOwner: shipOwner,
      lineName: shipName,
      hullNo: hullNo,
      regionName: regionVal,
      details: workContent,
      message: transferMsg,
      unavailable: isUnavailable,
      managerId: managerId,
      asNo: asNoVal,       // AS No. 추가
      asType: asTypeVal,   // AS 구분 추가
      country: countryVal,  // 국가 추가
      eta: etaVal,
      etb: etbVal,
      etd: etdVal,
      status: "일정 등록"
    };
    schedules.push(newSch);
    
    // 추가 엔지니어 처리는 기존과 동일하게 유지
    extraSelects.forEach(sel => {
      const uid = sel.value;
      if(uid){
        const newId2 = Date.now() + Math.floor(Math.random() * 100000);
        schedules.push({
          id: newId2,
          userId: uid,
          startDate: sDate,
          endDate: eDate,
          imoNo: imoNo,
          shipOwner: shipOwner,
          lineName: shipName,
          hullNo: hullNo,
          regionName: regionVal,
          details: workContent,
          message: transferMsg,
          unavailable: isUnavailable,
          managerId: managerId,
          asNo: asNoVal,       // AS No. 추가
          asType: asTypeVal,   // AS 구분 추가
          country: countryVal,  // 국가 추가
          eta: etaVal,
          etb: etbVal,
          etd: etdVal,
          status: "일정 등록"
        });
      }
    });
    
    db.ref("schedules").set(schedules).then(() => { 
      return loadAllData(); 
    })
    .then(() => {
      recordHistory("추가", currentUid, newSch);
      alert("새 일정이 추가되었습니다.");
      closeModal();
      refreshCalendar();
    })
    .catch(err => {
      console.error("저장 오류:", err);
      alert("저장 중 오류가 발생했습니다: " + err.message);
    });
  }
}
