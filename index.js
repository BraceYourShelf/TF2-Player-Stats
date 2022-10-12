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

function filterTable() {
    // Declare variables
    let input = document.getElementById("filter");
    let filter = input.value.toUpperCase();
    let table = document.getElementById(currentClassShown);
    let tr = table.getElementsByTagName("tr");
    let index = document.getElementById("filterCategory").selectedIndex;
  
    // Loop through all table rows, and hide those who don't match the search query
    for (let i = 0; i < tr.length; i++) {
      let td = tr[i].getElementsByTagName("td")[index];
      if (td) {
        let txtValue = td.textContent || td.innerText;
        if (txtValue.toUpperCase().indexOf(filter) > -1) {
          tr[i].style.display = "";
        } else {
          tr[i].style.display = "none";
        }
      }
    }
  }