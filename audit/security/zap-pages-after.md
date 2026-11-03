# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| Informational | 2 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Info | Informational | https://rem-content-studio.pages.dev | Percentage of responses with status code 2xx | 100 % |
| Info | Informational | https://rem-content-studio.pages.dev | Percentage of endpoints with content type image/png | 3 % |
| Info | Informational | https://rem-content-studio.pages.dev | Percentage of endpoints with content type image/svg+xml | 3 % |
| Info | Informational | https://rem-content-studio.pages.dev | Percentage of endpoints with content type image/webp | 53 % |
| Info | Informational | https://rem-content-studio.pages.dev | Percentage of endpoints with content type text/html | 33 % |
| Info | Informational | https://rem-content-studio.pages.dev | Percentage of endpoints with content type text/markdown | 3 % |
| Info | Informational | https://rem-content-studio.pages.dev | Percentage of endpoints with content type text/plain | 3 % |
| Info | Informational | https://rem-content-studio.pages.dev | Percentage of endpoints with method GET | 100 % |
| Info | Informational | https://rem-content-studio.pages.dev | Count of total endpoints | 30    |
| Info | Informational | https://rem-content-studio.pages.dev | Percentage of slow responses | 87 % |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| Re-examine Cache-control Directives | Informational | Systemic |
| Storable but Non-Cacheable Content | Informational | Systemic |




## Alert Detail



### [ Re-examine Cache-control Directives ](https://www.zaproxy.org/docs/alerts/10015/)



##### Informational (Low)

### Description

The cache-control header has not been set properly or is missing, allowing the browser and proxies to cache content. For static assets like css, js, or image files this might be intended, however, the resources should be reviewed to ensure that no sensitive content will be cached.

* URL: https://rem-content-studio.pages.dev
  * Node Name: `https://rem-content-studio.pages.dev`
  * Method: `GET`
  * Parameter: `cache-control`
  * Attack: ``
  * Evidence: `public, max-age=0, must-revalidate`
  * Other Info: ``
* URL: https://rem-content-studio.pages.dev/
  * Node Name: `https://rem-content-studio.pages.dev/`
  * Method: `GET`
  * Parameter: `cache-control`
  * Attack: ``
  * Evidence: `public, max-age=0, must-revalidate`
  * Other Info: ``
* URL: https://rem-content-studio.pages.dev/images/CREDITS.md
  * Node Name: `https://rem-content-studio.pages.dev/images/CREDITS.md`
  * Method: `GET`
  * Parameter: `cache-control`
  * Attack: ``
  * Evidence: `public, max-age=0, must-revalidate`
  * Other Info: ``
* URL: https://rem-content-studio.pages.dev/robots.txt
  * Node Name: `https://rem-content-studio.pages.dev/robots.txt`
  * Method: `GET`
  * Parameter: `cache-control`
  * Attack: ``
  * Evidence: `public, max-age=0, must-revalidate`
  * Other Info: ``
* URL: https://rem-content-studio.pages.dev/sitemap.xml
  * Node Name: `https://rem-content-studio.pages.dev/sitemap.xml`
  * Method: `GET`
  * Parameter: `cache-control`
  * Attack: ``
  * Evidence: `public, max-age=0, must-revalidate`
  * Other Info: ``

Instances: Systemic


### Solution

For secure content, ensure the cache-control HTTP header is set with "no-cache, no-store, must-revalidate". If an asset should be cached consider setting the directives "public, max-age, immutable".

### Reference


* [ https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#web-content-caching ](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#web-content-caching)
* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)
* [ https://grayduck.mn/2021/09/13/cache-control-recommendations/ ](https://grayduck.mn/2021/09/13/cache-control-recommendations/)


#### CWE Id: [ 525 ](https://cwe.mitre.org/data/definitions/525.html)


#### WASC Id: 13

#### Source ID: 3

### [ Storable but Non-Cacheable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are storable by caching components such as proxy servers, but will not be retrieved directly from the cache, without validating the request upstream, in response to similar requests from other users.

* URL: https://rem-content-studio.pages.dev
  * Node Name: `https://rem-content-studio.pages.dev`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=0`
  * Other Info: ``
* URL: https://rem-content-studio.pages.dev/
  * Node Name: `https://rem-content-studio.pages.dev/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=0`
  * Other Info: ``
* URL: https://rem-content-studio.pages.dev/apple-touch-icon.png
  * Node Name: `https://rem-content-studio.pages.dev/apple-touch-icon.png`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=0`
  * Other Info: ``
* URL: https://rem-content-studio.pages.dev/images/hero-960.webp
  * Node Name: `https://rem-content-studio.pages.dev/images/hero-960.webp`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=0`
  * Other Info: ``
* URL: https://rem-content-studio.pages.dev/sitemap.xml
  * Node Name: `https://rem-content-studio.pages.dev/sitemap.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=0`
  * Other Info: ``

Instances: Systemic


### Solution



### Reference


* [ https://datatracker.ietf.org/doc/html/rfc7234 ](https://datatracker.ietf.org/doc/html/rfc7234)
* [ https://datatracker.ietf.org/doc/html/rfc7231 ](https://datatracker.ietf.org/doc/html/rfc7231)
* [ https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html ](https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)


#### CWE Id: [ 524 ](https://cwe.mitre.org/data/definitions/524.html)


#### WASC Id: 13

#### Source ID: 3


