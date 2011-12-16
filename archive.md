---
layout: default
---
<section class="content">
<ul class="posts">
{% for p in site.posts %}
	<li>
		<div class="date">
			{{ p.date | date:"%b %d"}}
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
</section>
