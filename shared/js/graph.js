function plotGraph(name, container_id, choices_id, raw_data, legend_pos)
{
	// Precalculate containers
	var container = $(container_id);
	var choiceContainer = $(choices_id);

	// Prepare data
	var data = [];
	var i = 0;

	for (var k in raw_data)
	{
		var n = raw_data[k];
		var label = n[0];

		// Convert data item
		var line = {
			data: n[1],
			label: label + ' = 0.00',
			color: i
		};
		
		data[label] = line;
		i += 1;

		// Generate checkbox
		choiceContainer.append($('<input/>')
								.attr('type', 'checkbox')
								.attr('name', label)
								.attr('id', name + label)
								.attr('checked', 'checked')								
							  );
		choiceContainer.append($('<label/>')
								.attr('for', name + label)
								.text(label)
							  );		
	}

	var currentPlot = null;

	// Do actual plotting
	function plot()
	{
		var finalData = [];

		choiceContainer.find("input:checked").each(function() {
			var key = $(this).attr('name');
			if (key && data[key])
				finalData.push(data[key]);
		});

		if (finalData.length > 0)
		{
			var options = { 
						series: {
					  		lines: { 
						  		show: true
							}
					    },
					    legend: {
					    	position: legend_pos
					    },
					    crosshair: 
					    { 
						    mode: "x" 
						},
					    grid: { 
						    hoverable: true, 
						    autoHighlight: false 
						},
					    yaxis: { 
						    tickSize: 200									 
						}
					};

			currentPlot = $.plot(container, finalData, options);
		}				
	}

	// Refresh it
	plot();

	// Bind refresh on click
	choiceContainer.find('input').click(plot);

	// Handle mouse hover
	var updateLegendTimeout = null;
	var latestPosition = null;

	function updateLegend() {
		updateLegendTimeout = null;

		var pos = latestPosition;

	 	var legends = container.find('.legendLabel');

		var axes = currentPlot.getAxes();
		if (pos.x < axes.xaxis.min || pos.x > axes.xaxis.max ||
            pos.y < axes.yaxis.min || pos.y > axes.yaxis.max)
            return;
 
        var i, j, dataset = currentPlot.getData();
        for (i = 0; i < dataset.length; ++i) {
            var series = dataset[i];
 
            // find the nearest points, x-wise
            for (j = 0; j < series.data.length; ++j)
                if (series.data[j][0] > pos.x)
                    break;
            
            // now interpolate
            var y, p1 = series.data[j - 1], p2 = series.data[j];
            if (p1 == null)
                y = p2[1];
            else if (p2 == null)
                y = p1[1];
            else
                y = p1[1] + (p2[1] - p1[1]) * (pos.x - p1[0]) / (p2[0] - p1[0]);
 
            legends.eq(i).text(series.label.replace(/=.*/, "= " + y.toFixed(2)));
        }
 	}

	container.bind('plothover', function(event, pos, item) {
		latestPosition = pos;
		if (!updateLegendTimeout)
			updateLegendTimeout = setTimeout(updateLegend, 50);
	});
}
