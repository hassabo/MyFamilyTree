let familyData = [];
let resizeTimeout;

// Add resize handler for responsive line drawing
window.addEventListener('resize', () => {
  // Debounce the resize event
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    requestAnimationFrame(drawCurvedLines);
  }, 100);
});

// Prevent double-tap zoom on touch devices
document.addEventListener('touchstart', function(event) {
  if (event.target.classList.contains('person')) {
    event.preventDefault();
  }
}, { passive: false });

window.onload = function() {
  fetch('family.xlsx')
    .then(response => response.arrayBuffer())
    .then(data => {
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      familyData = XLSX.utils.sheet_to_json(firstSheet);
      renderTree();
    })
    .catch(err => {
      document.getElementById('tree').innerHTML = "<p style='color:red'>⚠️ لم يتم تحميل ملف العائلة.</p>";
      console.error("Error:", err);
    });
};

function renderTree() {
  const container = document.getElementById("tree");
  container.innerHTML = "";
  document.getElementById("lines").innerHTML = "";

  // Find the first root person (ParentID empty)
  const root = familyData.find(p => !p.ParentID);
  if (!root) return;
  const rootLevelId = 'root-level';

  // Level 1: root
  const level1 = [root];
  const level1Div = createLevel(level1);
  level1Div.id = rootLevelId;
  container.appendChild(level1Div);

  // Level 2: children of root
  const level2 = familyData.filter(p => p.ParentID == root.ID);
  const level2Div = createLevel(level2);
  container.appendChild(level2Div);

  // Level 3: grandchildren (children of level 2)
  const level3 = familyData.filter(p => level2.some(parent => parent.ID == p.ParentID));
  const level3Div = createLevel(level3, { expandable: true });
  container.appendChild(level3Div);

  // Draw connecting lines
  requestAnimationFrame(drawCurvedLines);

  // Scroll to root with a small delay to ensure rendering is complete
  requestAnimationFrame(() => {
    const rootLevel = document.getElementById(rootLevelId);
    if (rootLevel) {
      const rootNode = rootLevel.querySelector('.person');
      if (rootNode) {
        // Get the root node's position
        const rootRect = rootNode.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        // Calculate the scroll position to center the root
        const scrollX = (rootRect.left + rootRect.width / 2) - (window.innerWidth / 2);
        const scrollY = rootRect.top - 100; // 100px from top
        window.scrollTo({
          left: scrollX + window.scrollX,
          top: scrollY + window.scrollY,
          behavior: 'smooth'
        });
        // Add a subtle highlight animation to the root node
        rootNode.style.transition = 'all 0.5s ease';
        rootNode.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.5)';
        setTimeout(() => {
          rootNode.style.boxShadow = '';
        }, 2000);
      }
    }
  });
}


function createLevel(members, options = {}) {
  const level = document.createElement("div");
  level.className = "level";
  members.forEach(p => {
    const div = document.createElement("div");
    div.className = "person";
    div.dataset.id = p.ID;
    div.onclick = () => showPopup(p);

    const name = document.createElement("div");
    name.className = "person-name";
    name.textContent = p.Name;

    const year = document.createElement("div");
    year.className = "person-year";
    year.textContent = p.BirthYear ? `ولد عام ${p.BirthYear}` : "";

    div.appendChild(name);
    div.appendChild(year);

    // If expandable, add a button to show children if any
    if (options.expandable) {
      const hasChildren = familyData.some(child => child.ParentID == p.ID);
      if (hasChildren) {
        const expandBtn = document.createElement('button');
        expandBtn.textContent = 'عرض الأبناء';
        expandBtn.className = 'expand-children-btn';
        expandBtn.onclick = (e) => {
          e.stopPropagation();
          toggleChildrenLevel(div, p.ID);
        };
        div.appendChild(expandBtn);
      }
    }

    level.appendChild(div);
  });
  return level;
}

// Show/hide children for a given node in level 3
function toggleChildrenLevel(parentDiv, parentId) {
  // Only remove the expanded children level directly after this parent row
  const tree = document.getElementById('tree');
  const allLevels = Array.from(tree.children);
  const parentLevel = parentDiv.closest('.level');
  const parentIndex = allLevels.indexOf(parentLevel);
  if (parentIndex !== -1 && allLevels[parentIndex + 1] && allLevels[parentIndex + 1].classList.contains('expanded-children-level')) {
    tree.removeChild(allLevels[parentIndex + 1]);
    requestAnimationFrame(drawCurvedLines);
    return;
  }
  // Find children
  const children = familyData.filter(p => p.ParentID == parentId);
  if (children.length === 0) return;
  // Create a new .level row for children
  const childrenLevel = document.createElement('div');
  childrenLevel.className = 'level expanded-children-level';
  children.forEach(child => {
    const div = document.createElement('div');
    div.className = 'person';
    div.dataset.id = child.ID;
    div.onclick = () => showPopup(child);
    const name = document.createElement('div');
    name.className = 'person-name';
    name.textContent = child.Name;
    const year = document.createElement('div');
    year.className = 'person-year';
    year.textContent = child.BirthYear ? `ولد عام ${child.BirthYear}` : "";
    div.appendChild(name);
    div.appendChild(year);
    // Recursively allow further expansion
    const hasChildren = familyData.some(grandchild => grandchild.ParentID == child.ID);
    if (hasChildren) {
      const expandBtn = document.createElement('button');
      expandBtn.textContent = 'عرض الأبناء';
      expandBtn.className = 'expand-children-btn';
      expandBtn.onclick = (e) => {
        e.stopPropagation();
        toggleChildrenLevel(div, child.ID);
      };
      div.appendChild(expandBtn);
    }
    childrenLevel.appendChild(div);
  });
  // Insert the new level directly after the parent level
  if (parentIndex !== -1 && allLevels[parentIndex + 1]) {
    tree.insertBefore(childrenLevel, allLevels[parentIndex + 1]);
  } else {
    tree.appendChild(childrenLevel);
  }
  requestAnimationFrame(drawCurvedLines);
}

function drawCurvedLines() {
  const svg = document.getElementById("lines");
  const treeContainer = document.getElementById("treeContainer");
  
  // Update SVG size to match container
  const containerRect = treeContainer.getBoundingClientRect();
  svg.setAttribute('width', containerRect.width);
  svg.setAttribute('height', containerRect.height);
  
  svg.innerHTML = "";
  const persons = document.querySelectorAll(".person");
  const rect = treeContainer.getBoundingClientRect();

  persons.forEach(child => {
    const childId = child.dataset.id;
    const childData = familyData.find(p => p.ID == childId);
    if (!childData?.ParentID) return;

    const parent = document.querySelector(`.person[data-id='${childData.ParentID}']`);
    if (!parent) return;

    const parentBox = parent.getBoundingClientRect();
    const childBox = child.getBoundingClientRect();

    const x1 = parentBox.left + parentBox.width / 2 - rect.left;
    const y1 = parentBox.bottom - rect.top;
    const x2 = childBox.left + childBox.width / 2 - rect.left;
    const y2 = childBox.top - rect.top;

    const midY = (y1 + y2) / 2;
    const pathData = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("stroke", "#9ca3af");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("fill", "none");

    svg.appendChild(path);
  });
}

// Search feature temporarily disabled
/*
function searchMember() {
  const query = document.getElementById("searchInput").value.trim();
  renderTree(query);
}
*/

// Helper function to get ancestry path to root
function getAncestryPath(person) {
  const path = [person];
  let current = person;
  
  while (current.ParentID) {
    const parent = familyData.find(p => p.ID.toString() === current.ParentID.toString());
    if (!parent) break;
    path.unshift(parent); // Add to start of array
    current = parent;
  }
  
  return path;
}

function showPopup(person) {
  const popupContainer = document.getElementById("popupBoxesContainer");

  // Remove old container if exists
  const oldContainer = document.getElementById("popupBoxesContainer");
  if (oldContainer) oldContainer.remove();

  // Create new container
  const container = document.createElement("div");
  container.id = "popupBoxesContainer";
  container.className = "popup-boxes";
  
  // Add ancestry path
  const ancestryDiv = document.createElement("div");
  ancestryDiv.className = "ancestry-path";
  const ancestors = getAncestryPath(person);
  const ancestryPath = [...ancestors].reverse().map(p => p.Name).join(" ← ");
  ancestryDiv.textContent = ancestryPath;
  container.appendChild(ancestryDiv);

  // Spouses
  let spouseLabel = "الزوج/الزوجة";
  if (person.Gender) spouseLabel = person.Gender.toUpperCase() === "M" ? "الزوجة" : "الزوج";

  const spouseDiv = document.createElement("div");
  spouseDiv.textContent = spouseLabel + ": ";

  if (person.SpouseID) {
    const ids = person.SpouseID.toString().split(",").map(id => id.trim());
    const spouses = familyData.filter(p => ids.includes(p.ID.toString()));

    if (spouses.length > 0) {
      spouses.forEach(sp => {
        const span = document.createElement("span");
        span.className = "spouse-box";
        span.textContent = sp.Name;
        span.style.marginBottom = "0"; // spacing handled by container
        spouseDiv.appendChild(span);
      });
    } else {
      spouseDiv.innerHTML += "غير معروف";
    }
  } else {
    spouseDiv.innerHTML += "غير معروف";
  }
  container.appendChild(spouseDiv);

  // Parent (Mother/Father)
  const parentDiv = document.createElement("div");
  if (person.MotherID) {
    const parent = familyData.find(p => p.ID.toString() === person.MotherID.toString());
    if (parent) {
      const parentLabel = parent.Gender?.toUpperCase() === "M" ? "الأب" : "الأم";
      parentDiv.textContent = `${parentLabel}: `;
      const span = document.createElement("span");
      span.className = "spouse-box"; // same style as spouse
      span.textContent = parent.Name;
      span.style.marginBottom = "0"; // spacing handled by container
      parentDiv.appendChild(span);
    } else {
      parentDiv.textContent = "الوالد/ة: غير معروف";
    }
  } else {
    parentDiv.textContent = "الوالد/ة: غير معروف";
  }
  container.appendChild(parentDiv);

  // Insert container into popup after birth info
  const popup = document.getElementById("popup");
  const birthElem = document.getElementById("popupBirth");
  birthElem.parentNode.insertBefore(container, birthElem.nextSibling);

  // Gender mapping
  let genderText = "غير معروف";
  if (person.Gender) {
    if (person.Gender.toUpperCase() === "M") genderText = "ذكر";
    else if (person.Gender.toUpperCase() === "F") genderText = "أنثى";
  }

  document.getElementById("popupName").textContent = person.Name;
  document.getElementById("popupGender").textContent = "النوع: " + genderText;
  document.getElementById("popupBirth").textContent = "سنة الميلاد: " + (person.BirthYear || "غير معروف");

  // Show popup
  document.getElementById("overlay").style.display = "block";
  document.getElementById("popup").style.display = "block";
}




function closePopup() {
  document.getElementById("overlay").style.display = "none";
  document.getElementById("popup").style.display = "none";
}
