// Global variables
let locationsList = [];
let selectedIndex = -1; // For keyboard navigation in location dropdown

// Helper to format string to Title Case
function toTitleCase(str) {
  return str.replace(/\w\S*/g, function(txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

// Debounce helper to throttle server requests
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Get bathroom count
function getBathValue() {
  const uiBathrooms = document.getElementsByName("uiBathrooms");
  for (let i = 0; i < uiBathrooms.length; i++) {
    if (uiBathrooms[i].checked) {
      return parseInt(uiBathrooms[i].value);
    }
  }
  return 2; // default fallback
}

// Get BHK count
function getBHKValue() {
  const uiBHK = document.getElementsByName("uiBHK");
  for (let i = 0; i < uiBHK.length; i++) {
    if (uiBHK[i].checked) {
      return parseInt(uiBHK[i].value);
    }
  }
  return 2; // default fallback
}

// Estimate price backend request
function estimatePrice() {
  const sqftInput = document.getElementById("uiSqft");
  const bhk = getBHKValue();
  const bathrooms = getBathValue();
  const locationHidden = document.getElementById("uiLocations");
  const locationSearch = document.getElementById("uiLocationsSearch");
  
  const priceValue = document.getElementById("priceValue");
  const priceUnit = document.getElementById("priceUnit");
  const priceDisplayWrapper = document.getElementById("priceDisplayWrapper");
  const insightsContainer = document.getElementById("insightsContainer");
  const pricePerSqft = document.getElementById("pricePerSqft");
  const totalINR = document.getElementById("totalINR");
  const summaryText = document.getElementById("summaryText");
  const loaderOverlay = document.getElementById("loaderOverlay");

  const sqft = parseFloat(sqftInput.value);
  const locationVal = locationHidden.value;

  // Validation
  if (isNaN(sqft) || sqft < 300 || sqft > 10000) {
    summaryText.innerHTML = "<span style='color: var(--accent-red); font-weight: 600;'>Please enter a valid area between 300 and 10,000 sqft.</span>";
    priceValue.innerText = "--";
    insightsContainer.style.display = "none";
    return;
  }

  if (!locationVal) {
    summaryText.innerHTML = "<span style='color: var(--text-dark); font-weight: 500;'>Please search and select a location to get the price.</span>";
    priceValue.innerText = "--";
    insightsContainer.style.display = "none";
    return;
  }

  // Show loader overlay
  loaderOverlay.style.display = "flex";
  priceDisplayWrapper.style.opacity = "0.5";

  const url = "/api/predict_home_price";

  $.post(url, {
    total_sqft: sqft,
    bhk: bhk,
    bath: bathrooms,
    location: locationVal
  }, function (data, status) {
    loaderOverlay.style.display = "none";
    priceDisplayWrapper.style.opacity = "1";
    
    if (status === "success" && data && typeof data.estimated_price === "number") {
      const priceLakh = data.estimated_price;
      
      // Dynamic price counting & formatting
      let displayPrice = priceLakh;
      let unit = "Lakh";
      
      if (priceLakh >= 100) {
        displayPrice = priceLakh / 100;
        unit = "Crore";
      }

      // Smooth number pop effect
      priceValue.classList.remove("pop-animation");
      void priceValue.offsetWidth; // trigger reflow
      priceValue.classList.add("pop-animation");

      priceValue.innerText = displayPrice.toFixed(2);
      priceUnit.innerText = unit;

      // Insights and details calculations
      const totalRupees = Math.round(priceLakh * 100000);
      const perSqft = Math.round(totalRupees / sqft);

      pricePerSqft.innerText = "₹ " + perSqft.toLocaleString('en-IN') + " / sqft";
      totalINR.innerText = "₹ " + totalRupees.toLocaleString('en-IN');
      insightsContainer.style.display = "flex";

      // Summary text
      summaryText.innerHTML = `Estimated valuation for a <strong>${bhk} BHK</strong> property with <strong>${bathrooms} bathrooms</strong> covering <strong>${sqft.toLocaleString()} sqft</strong> in <strong>${toTitleCase(locationVal)}</strong>.`;
      
      // Update fallback result if elements hook onto it
      const fallbackEst = document.getElementById("uiEstimatedPrice");
      if (fallbackEst) {
        fallbackEst.innerHTML = `<h2>${priceLakh.toFixed(2)} Lakh</h2>`;
      }
    } else {
      summaryText.innerHTML = "<span style='color: var(--accent-red); font-weight: 600;'>Error calculating price. Please check server.</span>";
      priceValue.innerText = "Error";
      insightsContainer.style.display = "none";
    }
  }).fail(function() {
    loaderOverlay.style.display = "none";
    priceDisplayWrapper.style.opacity = "1";
    summaryText.innerHTML = "<span style='color: var(--accent-red); font-weight: 600;'>API endpoint not reachable. Ensure backend is running.</span>";
    priceValue.innerText = "--";
    insightsContainer.style.display = "none";
  });
}

// Debounced wrapper for estimation
const debouncedEstimate = debounce(estimatePrice, 300);

// Set up autocomplete locations searchable list
function setupAutocomplete() {
  const searchInput = document.getElementById("uiLocationsSearch");
  const hiddenInput = document.getElementById("uiLocations");
  const listContainer = document.getElementById("uiLocationsList");
  const clearBtn = document.getElementById("clearLocationBtn");
  const toggleDropdownBtn = document.getElementById("toggleDropdownBtn");
  const wrapper = document.getElementById("autocompleteWrapper");

  function renderList(filterText = "") {
    listContainer.innerHTML = "";
    selectedIndex = -1;

    const filtered = locationsList.filter(loc => 
      loc.toLowerCase().includes(filterText.toLowerCase())
    );

    if (filtered.length === 0) {
      listContainer.innerHTML = '<div class="autocomplete-no-results">No locations found</div>';
      return;
    }

    filtered.forEach((loc, index) => {
      const div = document.createElement("div");
      div.className = "autocomplete-item";
      div.innerText = toTitleCase(loc);
      div.dataset.value = loc;

      div.addEventListener("click", function() {
        selectLocation(loc);
      });

      listContainer.appendChild(div);
    });
  }

  function selectLocation(loc) {
    searchInput.value = toTitleCase(loc);
    hiddenInput.value = loc;
    listContainer.style.display = "none";
    clearBtn.style.display = "flex";
    toggleDropdownBtn.classList.remove("open");
    estimatePrice(); // Trigger immediate estimate on selection
  }

  // Input event
  searchInput.addEventListener("input", function() {
    const val = this.value;
    listContainer.style.display = "block";
    toggleDropdownBtn.classList.add("open");
    clearBtn.style.display = val ? "flex" : "none";
    
    if (!val) {
      hiddenInput.value = "";
      debouncedEstimate(); // Refresh validation
    }
    
    renderList(val);
  });

  // Focus/Click event - shows all city names by default to mimic dropdown list
  searchInput.addEventListener("focus", function() {
    listContainer.style.display = "block";
    toggleDropdownBtn.classList.add("open");
    // Show all locations when clicking or focusing on the search input, allowing user to scroll
    renderList("");
  });

  // Toggle button click
  toggleDropdownBtn.addEventListener("click", function(e) {
    e.stopPropagation();
    const isVisible = listContainer.style.display === "block";
    if (isVisible) {
      listContainer.style.display = "none";
      toggleDropdownBtn.classList.remove("open");
    } else {
      listContainer.style.display = "block";
      toggleDropdownBtn.classList.add("open");
      renderList(""); // Always show all locations when opened via toggle
      searchInput.focus();
    }
  });

  // Clear button click
  clearBtn.addEventListener("click", function() {
    searchInput.value = "";
    hiddenInput.value = "";
    clearBtn.style.display = "none";
    listContainer.style.display = "none";
    toggleDropdownBtn.classList.remove("open");
    renderList("");
    estimatePrice();
  });

  // Keyboard navigation
  searchInput.addEventListener("keydown", function(e) {
    const items = listContainer.getElementsByClassName("autocomplete-item");
    if (items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex++;
      if (selectedIndex >= items.length) selectedIndex = 0;
      updateActiveItem(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex--;
      if (selectedIndex < 0) selectedIndex = items.length - 1;
      updateActiveItem(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex > -1 && items[selectedIndex]) {
        items[selectedIndex].click();
      } else if (items[0]) {
        // select first matching option if enter pressed without arrow keys
        items[0].click();
      }
    } else if (e.key === "Escape") {
      listContainer.style.display = "none";
      toggleDropdownBtn.classList.remove("open");
    }
  });

  function updateActiveItem(items) {
    for (let i = 0; i < items.length; i++) {
      items[i].classList.remove("active");
    }
    if (selectedIndex > -1 && items[selectedIndex]) {
      items[selectedIndex].classList.add("active");
      items[selectedIndex].scrollIntoView({ block: "nearest" });
    }
  }

  // Close list when clicking outside
  document.addEventListener("click", function(e) {
    if (!wrapper.contains(e.target)) {
      listContainer.style.display = "none";
      toggleDropdownBtn.classList.remove("open");
    }
  });
}

// Clicked Estimate Price fallback trigger function
function onClickedEstimatePrice() {
  estimatePrice();
}

// Initial page setup on page load
function onPageLoad() {
  console.log("document loaded - BHP ML Custom UI");
  
  // Set up syncing between Sqft slider and Sqft numeric text input
  const sqftInput = document.getElementById("uiSqft");
  const sqftSlider = document.getElementById("uiSqftSlider");
  const sqftBadge = document.getElementById("sqftBadge");

  function updateSqftDisplay(val) {
    sqftBadge.innerText = parseInt(val).toLocaleString() + " sqft";
  }

  sqftSlider.addEventListener("input", function() {
    sqftInput.value = this.value;
    updateSqftDisplay(this.value);
    debouncedEstimate();
  });

  sqftInput.addEventListener("input", function() {
    let val = parseFloat(this.value);
    if (isNaN(val)) val = 300;
    
    // Bounds validation for range slider sync
    if (val >= 300 && val <= 10000) {
      sqftSlider.value = val;
    }
    updateSqftDisplay(this.value || 300);
    debouncedEstimate();
  });

  // Bind change events for BHK and Bathroom control pills
  const bhkInputs = document.getElementsByName("uiBHK");
  bhkInputs.forEach(input => {
    input.addEventListener("change", estimatePrice);
  });

  const bathInputs = document.getElementsByName("uiBathrooms");
  bathInputs.forEach(input => {
    input.addEventListener("change", estimatePrice);
  });

  // Load locations via GET API request
  const url = "/api/get_location_names";
  
  $.get(url, function (data, status) {
    console.log("got response for get_location_names request");
    if (data && data.locations) {
      locationsList = data.locations;
      setupAutocomplete();

      // Set default location to Whitefield or first item if found, to demonstrate live load
      const defaultLoc = locationsList.includes("whitefield") ? "whitefield" : locationsList[0];
      if (defaultLoc) {
        document.getElementById("uiLocationsSearch").value = toTitleCase(defaultLoc);
        document.getElementById("uiLocations").value = defaultLoc;
        document.getElementById("clearLocationBtn").style.display = "flex";
        estimatePrice(); // Initial estimate run
      }
    }
  });
}

// Bind load handler
window.onload = onPageLoad;