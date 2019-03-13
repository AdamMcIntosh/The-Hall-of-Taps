# Welcome to the Hall of Taps

An alternative craft beer hall of fame

## 2019 Hall Nominees Preview

<ul>
{% for member in site.data.preview %}
  <li>
    <a href="">
      {{ member.BeerName }}
    </a>
  </li>
{% endfor %}
</ul>


## On Tap
<ul>
  {% for post in site.posts %}
    <li>
      <a href="{{ post.url }}">{{ post.title }}</a>
    </li>
  {% endfor %}
</ul>
