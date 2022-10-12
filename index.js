let currentClassShown = 'scout';

function toggleClassTable(classId) {
  let element = document.getElementById(currentClassShown);
  element.classList.toggle("table-shown");
  element.classList.toggle("table-hidden");

  element = document.getElementById(classId);
  element.classList.toggle("table-shown");
  element.classList.toggle("table-hidden");

  currentClassShown = classId;
}