table style="width:100%">
  <tr>
    <th>Brewery </th>
    <th>City</th>
    <th>State</th>
    <th>Country</th>
  </tr>
  {% for member in site.data.breweries %}
  <tr>
  <td>{{ member.BreweryName }}</td>
  <td>{{ member.City }}</td>
  <td>{{ member.BreweryState }}</td>
  <td>{{ member.Country }}</td>
  </tr>
  {% endfor %}
</table>
