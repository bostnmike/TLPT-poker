# Cashier delivery

Requested Cashier changes include publication. Run the quality checks, merge
the reviewed change to main, and follow the Cashier workflow through production
verification before reporting completion. Do not wait for a separate request to
publish. If credentials, checks, deployment or verification block delivery,
report the concrete blocker; never describe an unpublished change as live.

Follow DEPLOYMENT.md. Preserve the historical production Worker name
`tlpt-cashier-staging`, its existing production D1 database, encrypted password,
session key and import token. Keep staging separate. Never reset credentials,
replace databases or change the Google reader as part of an ordinary release.
Update the Pages gateway only when its files or configuration change. Preserve
Workers Free, fail-closed quota behavior, and the branded cashier shortcut.
Cashier work does not authorize changes to registration, Lily or Marchand.
