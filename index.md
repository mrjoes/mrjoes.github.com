---
layout: default
---
<ul class="posts">
{% for p in site.posts limit 5 %}
	<li>
		<div class="date">
			{{ p.date | date:"%b %d, %Y"}}
		</div>
		<div>
			<a href="{{ p.url }}"><h3>{{ p.title }}</h3></a>
		</div>
		{% if p.abstract %}
		<div>
			<em>{{ p.abstract }}</em>
		</div>
		{% endif %}
	</li>
{% endfor %}
</ul>