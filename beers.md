<table style="width:100%">
  <tr>
    <th>Beer </th>
    <th>Style</th>
    <th>Brewery</th>
    <th>ABV</th>
    <th>IBU</th>
    <th>Hall Rating</th>
  </tr>
  {% for member in site.data.beers %}
 <tr>
  <td>{{ member.BeerName }}</td>
  <td>{{ member.BeerStyle }}</td>
  <td>{{ member.BreweryName }}</td>
  <td>{{ member.BeerAbv }}</td>
  <td>{{ member.BeerIbu }}</td>
  <td>{{ member.HallRating }}</td>
  </tr> 
  {% endfor %}
</table>
