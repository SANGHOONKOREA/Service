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
          document.getElementById("btnAdmin").style.display = (currentUser.role === "관리자") ? "inline-block" : "none";
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
    if(currentUser.role === "관리자"){
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
  if(currentUser.role === "관리자" || currentUser.role === "본사") return true;
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
  const btnComplete = document.getElementById("btnCompleteService"); // 추가

  // 초기 상태 설정
  btnDelete.style.display = "none";
  btnCancel.style.display = "none";
  btnFinalize.style.display = "none";
  btnComplete.style.display = "none"; // 추가
  document.getElementById("scheduleStatusLabel").textContent = "";
  document.getElementById("modalIMONo").value = "";
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

  // 서비스 불가 체크박스에 이벤트 핸들러 추가
  document.getElementById("modalUnavailable").onchange = toggleManagerField;

  // 1) 권한별 엔지니어/담당자/체크박스 표시
  if (currentUser.role === "관리자" || currentUser.role === "본사") {
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
  document.getElementById("modalStartDate").value = sch.startDate;
  document.getElementById("modalEndDate").value   = sch.endDate;
  document.getElementById("modalIMONo").value     = sch.imoNo || "";
  document.getElementById("modalLine").value      = sch.lineName || "";
  document.getElementById("modalHullNo").value    = sch.hullNo || "";
  document.getElementById("modalRegion").value    = sch.regionName || "";
  document.getElementById("modalDetails").value   = sch.details || "";
  document.getElementById("modalMessage").value   = sch.message || "";
  document.getElementById("modalUnavailable").checked = !!sch.unavailable;
  document.getElementById("modalETA").value = sch.eta || "";
  document.getElementById("modalETB").value = sch.etb || "";
  document.getElementById("modalETD").value = sch.etd || "";

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

  
  // 버튼 및 기타 요소 처리 (필요 시)
  document.getElementById("btnSaveSchedule").textContent = "일정 변경";

    // 버튼 표시
    btnSave.textContent = "일정 변경";
    if (currentUser.role === "관리자" || currentUser.role === "본사") {
      userRow.style.display = "";
      buildEngineerSelectOptions(sel, sch.userId);
      btnDelete.style.display = "inline-block";
      btnCancel.style.display = "inline-block";
      btnFinalize.style.display = "inline-block";
      btnComplete.style.display = "inline-block"; // 추가
    } else {
      userRow.style.display = "none";
      btnCancel.style.display = "inline-block";
      btnFinalize.style.display = "inline-block";
      btnComplete.style.display = "inline-block"; // 추가
    }
    
    // 서비스 완료 상태면 다른 버튼들 비활성화
    if (sch.status === "completed") {
      btnSave.disabled = true;
      btnCancel.disabled = true;
      btnFinalize.disabled = true;
      btnComplete.disabled = true;
      document.getElementById("btnSendEmail").disabled = false; // 이메일 발송은 가능
    } else {
      btnSave.disabled = false;
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
  
  // 서비스 불가 체크박스 상태에 따라 본사 담당자 필드 초기 상태 설정
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
function saveSchedule(){
  const sDate = document.getElementById("modalStartDate").value;
  const eDate = document.getElementById("modalEndDate").value;
  const imoNo = document.getElementById("modalIMONo").value.trim();
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
  
  let mainUserId = (document.getElementById("modalUserRow").style.display !== "none") ? document.getElementById("modalUserSelect").value : currentUid;
  const extraContainer = document.getElementById("additionalEngineerRows");
  const extraSelects = extraContainer.querySelectorAll("select");
  
// saveSchedule() 함수 내의 managerId 처리 부분
const managerId = isUnavailable ? 
  '' : // 서비스 불가인 경우 빈 값으로 처리
  document.getElementById("modalManagerSelect").value;
  
  if(editingScheduleId){
    var finalizeAnswer = confirm("일정변경 후에 최종 확정 할까요?");
    const idx = schedules.findIndex(x => x.id === editingScheduleId);
    if(idx > -1){
      if(!canAccessSchedule(schedules[idx])){ alert("수정 권한 없음"); return; }
      const oldSch = { startDate: schedules[idx].startDate, endDate: schedules[idx].endDate };
      schedules[idx].userId = mainUserId;
      schedules[idx].startDate = sDate;
      schedules[idx].endDate = eDate;
      schedules[idx].imoNo = imoNo;
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
    if(users[uid].role === "본사" || users[uid].role === "관리자"){
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

  // exportData 생성 – 헤더를 한글로 지정
  const exportData = schedules.map(sch => {
    const managerName =
      sch.managerId && users[sch.managerId] ? users[sch.managerId].id : "";
    const engineerName =
      sch.userId && users[sch.userId] ? users[sch.userId].id : "";
    // 상태 표시: unavailable이 true이면 "서비스 불가" 우선 적용
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
    return {
      "시작일": sch.startDate,
      "종료일": sch.endDate,
      "선박명": sch.lineName || "",
      "IMO 번호": sch.imoNo || "",
      "Hull 번호": sch.hullNo || "",
      "지역": sch.regionName || "",
      "작업내용": sch.details || "",
      "상태": displayStatus,
      "서비스 불가": sch.unavailable ? "true" : "false",
      "엔지니어": engineerName,
      "본사 담당자": managerName,
      "도착예정": sch.eta || "",
      "접안예정": sch.etb || "",
      "출항예정": sch.etd || ""
    };
  });

  // 워크시트와 워크북 생성
  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "스케줄");

  // --- 데이터 유효성 검사(드롭다운) 추가 ---
  // 고정 목록: 상태, 서비스 불가
  const statusList =
    "일정 등록 대기,일정 등록,일정 변경,일정 취소,일정 확정,서비스 완료,서비스 불가";
  const unavailableList = "true,false";

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
    if (users[uid].role === "본사" || users[uid].role === "관리자") {
      managerOptions.push(users[uid].id);
    }
  }
  const hqManagerList = Array.from(new Set(managerOptions)).join(",");

  // 데이터 유효성 검사 적용: 헤더는 1행에 있으므로 데이터는 2행부터 (예: 2행 ~ 1000행)
  ws["!dataValidation"] = [
    {
      sqref: "H2:H1000", // 상태 열 (H열)
      type: "list",
      formula1: "\"" + statusList + "\""
    },
    {
      sqref: "I2:I1000", // 서비스 불가 열 (I열)
      type: "list",
      formula1: "\"" + unavailableList + "\""
    },
    {
      sqref: "J2:J1000", // 엔지니어 열 (J열)
      type: "list",
      formula1: "\"" + engineerList + "\""
    },
    {
      sqref: "K2:K1000", // 본사 담당자 열 (K열)
      type: "list",
      formula1: "\"" + hqManagerList + "\""
    }
  ];
  // --- 끝 ---

  XLSX.writeFile(wb, "스케줄_템플릿.xlsx");
}

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
    const koreanToStatus = {
      "취소됨": "cancelled",
      "최종 확정": "finalized",
      "일정 변경 / 최종 확정": "일정 변경 / 최종 확정",
      "일정확정대기": "일정확정대기",
      "서비스 완료": "completed",
      "정상": "normal"
    };
    const newArr = jsonData.map(row => {
      let managerUid = "";
      if (row.hqManager) {
        for (const uid in users) {
          if (users[uid].role === "본사" && users[uid].id === row.hqManager) {
            managerUid = uid;
            break;
          }
        }
      }
      let engineerUid = "";
      if (row.engineer) {
        for (const uid in users) {
          if (users[uid].role === "협력" && users[uid].id === row.engineer) {
            engineerUid = uid;
            break;
          }
        }
      }
      const start = parseExcelDate(row.startDate);
      const end   = parseExcelDate(row.endDate);
      const unavailableBool = (row.unavailable === "네");
      const statusInternal = koreanToStatus[row.status] || row.status || "normal";
      return {
        id: Date.now() + Math.floor(Math.random() * 100000),
        startDate: start,
        endDate: end,
        lineName: row.Ship_Name || "",
        imoNo: row.IMO_No || "",
        hullNo: row.Hull_No || "",
        regionName: row.regionName || "",
        details: row.details || "",
        status: statusInternal,
        userId: engineerUid,
        unavailable: unavailableBool,
        managerId: managerUid,
        cancelReason: row.cancelReason || "",
        // ETA, ETB, ETD 추가
        eta: row.ETA || "",
        etb: row.ETB || "",
        etd: row.ETD || ""
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

  filtered.forEach(sch => {
    const tr = document.createElement("tr");

    // (a) 회사 (엔지니어 소속)
    const userObj = users[sch.userId] || {};
    const tdCompany = document.createElement("td");
    tdCompany.textContent = userObj.company || "(업체 미지정)";
    tr.appendChild(tdCompany);

    // (b) 엔지니어
    const tdEngineer = document.createElement("td");
    tdEngineer.textContent = userObj.id || "";
    tr.appendChild(tdEngineer);

    // (c) 기간
    const tdPeriod = document.createElement("td");
    tdPeriod.textContent = `${sch.startDate} ~ ${sch.endDate}`;
    tr.appendChild(tdPeriod);

    // (d) 선박명
    const tdShipName = document.createElement("td");
    tdShipName.textContent = sch.lineName || "";
    tr.appendChild(tdShipName);

    // (e) IMO 번호
    const tdIMONo = document.createElement("td");
    tdIMONo.textContent = sch.imoNo || "";
    tr.appendChild(tdIMONo);

    // (f) Hull 번호
    const tdHullNo = document.createElement("td");
    tdHullNo.textContent = sch.hullNo || "";
    tr.appendChild(tdHullNo);

    // (g) 지역
    const tdRegion = document.createElement("td");
    tdRegion.textContent = sch.regionName || "";
    tr.appendChild(tdRegion);

    // (h) 본사 담당자
    const tdManager = document.createElement("td");
    if (sch.managerId && users[sch.managerId]) {
      tdManager.textContent = users[sch.managerId].id || "";
    } else {
      tdManager.textContent = "";
    }
    tr.appendChild(tdManager);

    // (i) 작업내용
    const tdDetails = document.createElement("td");
    tdDetails.textContent = sch.details || "";
    tr.appendChild(tdDetails);

    // (j) 서비스 불가 (unavailable)
    const tdUnavail = document.createElement("td");
    tdUnavail.textContent = sch.unavailable ? "true" : "false";
    tr.appendChild(tdUnavail);

    // (k) 상태 (status) – unavailable이 true이면 우선 "서비스 불가"로 표시
    const tdStatus = document.createElement("td");
    if (sch.unavailable) {
      tdStatus.textContent = "서비스 불가";
    } else if (sch.status === "cancelled") {
      tdStatus.textContent = "일정 취소";
    } else if (sch.status === "completed") {
      tdStatus.textContent = "서비스 완료";
    } else if (
      sch.status === "finalized" ||
      sch.status === "일정 변경 / 최종 확정" ||
      sch.status === "일정 확정"
    ) {
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

    // (l) 수정 버튼
    const tdEdit = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.className = "admin-btn";
    editBtn.textContent = "수정";
    editBtn.onclick = () => openModal(sch.id);
    tdEdit.appendChild(editBtn);
    tr.appendChild(tdEdit);

    // (m) 삭제 버튼
    const tdDelete = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "admin-btn";
    delBtn.textContent = "삭제";
    delBtn.onclick = () => deleteAdminSchedule(sch.id);
    tdDelete.appendChild(delBtn);
    tr.appendChild(tdDelete);

    tbody.appendChild(tr);
  });
}

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
      if(users[uid].role === "본사" || users[uid].role === "관리자"){
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
function sendEmailNotification(){
  var startDate = document.getElementById("modalStartDate").value;
  var endDate = document.getElementById("modalEndDate").value;
  var imoNo = document.getElementById("modalIMONo").value.trim();
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
}

/****************************************
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
    if (users[uid].role === "본사" || users[uid].role === "관리자") {
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

/****************************************
 1) 엑셀 시리얼 날짜 변환 함수 (수정됨)
*****************************************/
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
