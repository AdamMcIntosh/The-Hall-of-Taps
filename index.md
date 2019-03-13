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

### Is there a way to objectively determine the best beer?
[The Hall of Taps gives us that answer.](about.md)

> We look at all the beers 
> people are drinking and quantify which ones are the best. 
> Just because a million people have checked-in Bells Two-Hearted Ale 
> that doesn't mean there isn't a better beer with only one hundred check-ins.
