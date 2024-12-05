async function fetchData() {
    try {
        const response = await fetch('/.netlify/functions/getSheetData');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        return result.values || [];
    } catch (error) {
        console.error('Error fetching data:', error);
        return [];
    }
}

async function init() {
    const rawData = await fetchData();
    const barChart = new BarChart();
    const trendChart = new TrendChart();
    const prDistribution = new PRDistributionChart();
    const testerDistribution = new TesterDistributionChart();

    // Initialize filters
    const platformFilter = document.getElementById('platformFilter');
    const monthFilter = document.getElementById('monthFilter');

    // Get all months from all relevant date columns
    const months = [...new Set(
        rawData.slice(1).flatMap(row => {
            return Array.from({length: 7}, (_, i) => row[i + 3])
                .filter(date => date)
                .map(date => {
                    const parsedDate = new Date(date);
                    return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}`;
                });
        })
    )].sort();

    // Populate month filter
    months.forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        const [year, monthNum] = month.split('-');
        const monthName = new Date(year, monthNum - 1).toLocaleString('en-US', { month: 'long' });
        option.textContent = `${monthName} ${year}`;
        monthFilter.appendChild(option);
    });

    // Populate platform filter
    const platforms = [...new Set(rawData.slice(1).map(row => row[1]))];
    platforms.forEach(p => {
        const option = document.createElement('option');
        option.value = p;
        option.textContent = p;
        platformFilter.appendChild(option);
    });

    // Update function with new filtering logic
    const updateCharts = () => {
        const selectedPlatform = platformFilter.value;
        const selectedMonth = monthFilter.value;
        
        // First filter by platform
        const platformFilteredRows = rawData.slice(1).filter(row => 
            selectedPlatform === 'all' || row[1] === selectedPlatform
        );

        // Calculate all durations
        const durations = calculateDurations(platformFilteredRows);
        
        // Then filter by selected month if needed
        const monthFilteredDurations = selectedMonth === 'all' 
            ? durations 
            : durations.filter(duration => {
                return Object.values(duration).some(metric => 
                    metric && metric.month === selectedMonth
                );
            });

        const statType = document.querySelector('input[name="statType"]:checked').value;

        // Update all charts
        barChart.update(monthFilteredDurations, statType);
        trendChart.update(monthFilteredDurations);
        prDistribution.update(monthFilteredDurations);
        testerDistribution.update(monthFilteredDurations);

        // Update Dev Cycle Time box
        const devCycleDurations = monthFilteredDurations
            .map(d => d['Dev Cycle Time'])
            .filter(d => d !== null)
            .map(d => d.value);

        document.getElementById('averageTime').textContent = barChart.calculateStat(devCycleDurations, 'average');
        document.getElementById('medianTime').textContent = barChart.calculateStat(devCycleDurations, 'median');
    };

    // Add event listeners
    platformFilter.addEventListener('change', updateCharts);
    monthFilter.addEventListener('change', updateCharts);
    document.querySelectorAll('input[name="statType"]').forEach(radio => {
        radio.addEventListener('change', updateCharts);
    });

    // Initial update
    updateCharts();
}

// Round to nearest integer
function roundToNearest(value) {
    return Math.round(value);
}

// Calculate durations for different steps
function calculateDurations(rows) {
    return rows.map(row => {
        const dates = {
            toDo: row[2] ? new Date(row[2]) : null,
            dev: row[3] ? new Date(row[3]) : null,
            pr: row[4] ? new Date(row[4]) : null,
            dr: row[5] ? new Date(row[5]) : null,
            rft: row[6] ? new Date(row[6]) : null,
            test: row[7] ? new Date(row[7]) : null,
            signoff: row[8] ? new Date(row[8]) : null,
            resolved: row[9] ? new Date(row[9]) : null,
        };

        // Calculate PR Review Time with conditional logic
        let prReviewTime = null;
        let prReviewEndDate = null;
        if (dates.pr) {
            if (dates.dr) {
                prReviewTime = roundToNearest((dates.dr - dates.pr) / (1000 * 60 * 60 * 24));
                prReviewEndDate = dates.dr;
            } else if (dates.rft) {
                prReviewTime = roundToNearest((dates.rft - dates.pr) / (1000 * 60 * 60 * 24));
                prReviewEndDate = dates.rft;
            }
        }

        // Format date to YYYY-MM
        const formatMonth = (date) => date ? date.toISOString().slice(0, 7) : null;

        return {
            'Backlog Time': dates.toDo && dates.dev ? {
                value: roundToNearest((dates.dev - dates.toDo) / (1000 * 60 * 60 * 24)),
                month: formatMonth(dates.dev)
            } : null,
            'Development Time': dates.dev && dates.pr ? {
                value: roundToNearest((dates.pr - dates.dev) / (1000 * 60 * 60 * 24)),
                month: formatMonth(dates.pr)
            } : null,
            'Pull Request Time': prReviewTime ? {
                value: prReviewTime,
                month: formatMonth(prReviewEndDate)
            } : null,
            'Design Review Time': dates.dr && dates.rft ? {
                value: roundToNearest((dates.rft - dates.dr) / (1000 * 60 * 60 * 24)),
                month: formatMonth(dates.rft)
            } : null,
            'Tester Assignment Time': dates.rft && dates.test ? {
                value: roundToNearest((dates.test - dates.rft) / (1000 * 60 * 60 * 24)),
                month: formatMonth(dates.test)
            } : null,
            'Testing Time': dates.test && dates.signoff ? {
                value: roundToNearest((dates.signoff - dates.test) / (1000 * 60 * 60 * 24)),
                month: formatMonth(dates.signoff)
            } : null,
            'PO Validation Time': dates.signoff && dates.resolved ? {
                value: roundToNearest((dates.resolved - dates.signoff) / (1000 * 60 * 60 * 24)),
                month: formatMonth(dates.resolved)
            } : null,
            'Full Cycle Time': dates.toDo && dates.resolved ? {
                value: roundToNearest((dates.resolved - dates.toDo) / (1000 * 60 * 60 * 24)),
                month: formatMonth(dates.resolved)
            } : null,
            'Dev Cycle Time': dates.dev && dates.resolved ? {
                value: roundToNearest((dates.resolved - dates.dev) / (1000 * 60 * 60 * 24)),
                month: formatMonth(dates.resolved)
            } : null
        };
    });
}

// Start the application
init();