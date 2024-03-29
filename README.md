[![New Relic Experimental header](https://github.com/newrelic/opensource-website/raw/master/src/images/categories/Experimental.png)](https://opensource.newrelic.com/oss-category/#new-relic-experimental)

# Automatic Grants for AUM Synced Groups
![GitHub forks](https://img.shields.io/github/forks/newrelic-experimental/nr-automatic-grants-for-aum?style=social)
![GitHub stars](https://img.shields.io/github/stars/newrelic-experimental/nr-automatic-grants-for-aum?style=social)
![GitHub watchers](https://img.shields.io/github/watchers/newrelic-experimental/nr-automatic-grants-for-aum?style=social)

![GitHub all releases](https://img.shields.io/github/downloads/newrelic-experimental/nr-automatic-grants-for-aum/total)
![GitHub release (latest by date)](https://img.shields.io/github/v/release/newrelic-experimental/nr-automatic-grants-for-aum)
![GitHub last commit](https://img.shields.io/github/last-commit/newrelic-experimental/nr-automatic-grants-for-aum)
![GitHub Release Date](https://img.shields.io/github/release-date/newrelic-experimental/nr-automatic-grants-for-aum)


![GitHub issues](https://img.shields.io/github/issues/newrelic-experimental/nr-automatic-grants-for-aum)
![GitHub issues closed](https://img.shields.io/github/issues-closed/newrelic-experimental/nr-automatic-grants-for-aum)
![GitHub pull requests](https://img.shields.io/github/issues-pr/newrelic-experimental/nr-automatic-grants-for-aum)
![GitHub pull requests closed](https://img.shields.io/github/issues-pr-closed/newrelic-experimental/nr-automatic-grants-for-aum)


This script, that can be run in a New Relic Synthetic API monitor, automates the creation of grants for new groups as they appear after syncing via [SCIM AUM](https://docs.newrelic.com/docs/accounts/accounts/automated-user-management/automated-user-provisioning-single-sign/).

This use case expects the accounts and roles that are the targets for the grants to already exist. Synced group names are expected to contain the account ID. This account ID is used along with a role mapping to determine what grants to generate. (The groups may instead include account name and a lookup will be made, see details below.)

Additionally the script creates grants for 'global' groups with roles specified by configuration.

![diagram](auto-grant.png)

## Configuration
Configuration is explained in the script. Add the [script.js](script.js) content to an "Endpoint availability" (Scripted API) synthetic monitor. 

You will require a user API key that has organisaztion management rights. Its highly recommended to supply this value via a [secure credential](https://docs.newrelic.com/docs/synthetics/synthetic-monitoring/using-monitors/store-secure-credentials-scripted-browsers-api-tests/). 

To determine some configuration values you will need to use the New Relic graphQL API:[US Datacenter](https://api.newrelic.com/graphiql) / [EU Datacenter](https://api.eu.newrelic.com/graphiql)

### Account Name ID Lookup
By default the script expects the AUM Group names to include the New Relic accountId in them. The ID is extracted from the group name and used for the grant. However, the script also supports the account name rather than ID to be included in the group name. If this matches your use case then set `ACCOUNT_ID_LOOKUP` to `true`. This will cause the script to lookup the account names and ID's and then match by name to determine the account ID. This has the added benefit of allowing multiple accounts to match allowing you to add grants to more than one account.

If you NR account names dont exactly match the component in your AD group name then you may customise the `accountLookupMatch()` function to manipulate the names accordingly. This method should return true if the parameters match. For instance you might have account names in AUM groups like this: "SomeAccountName" but in New Relic there might look like "Some Account Name". This feature allows you to easily deal with these simple differences.


### Global group lookup and block list
The default operation is for accounts discovered via AUM group lookup to be used as candidates for grants to global groups. However you may instead require global grants to be made against all accounts regarldess of their AUM group state. 

Setting `GLOBAL_ACCOUNT_ID_LOOKUP` to true will ignore the accounts discovered during the AUM group setup and instead lookup all the accounts via GraphQL.

You may omit accounts from global group grants by setting the `blockList` field in the `GLOBAL_CANDIDATE_GROUPS` object. this should be an arry of objects with id and name attributes.

### Local setup
You can run this script locally, be sure to `npm install` to install dependencies then `node script.js` to run.

### Authentication Domain ID
You can discover your authentication domain ID with this graphQL query:

```
{
  actor {
    organization {
      authorizationManagement {
        authenticationDomains {
          authenticationDomains {
            id
            name
          }
        }
      }
    }
  }
}
```

### Roles
You can discover your role ID's with this graphQL query:
```
{
  actor {
    organization {
      authorizationManagement {
        roles {
          roles {
            id
            name
          }
        }
      }
    }
  }
}
```

## Support

New Relic has open-sourced this project. This project is provided AS-IS WITHOUT WARRANTY OR DEDICATED SUPPORT. Issues and contributions should be reported to the project here on GitHub.

>We encourage you to bring your experiences and questions to the [Explorers Hub](https://discuss.newrelic.com) where our community members collaborate on solutions and new ideas.


## Contributing

We encourage your contributions to improve [Project Name]! Keep in mind when you submit your pull request, you'll need to sign the CLA via the click-through using CLA-Assistant. You only have to sign the CLA one time per project. If you have any questions, or to execute our corporate CLA, required if your contribution is on behalf of a company, please drop us an email at opensource@newrelic.com.

**A note about vulnerabilities**

As noted in our [security policy](../../security/policy), New Relic is committed to the privacy and security of our customers and their data. We believe that providing coordinated disclosure by security researchers and engaging with the security community are important means to achieve our security goals.

If you believe you have found a security vulnerability in this project or any of New Relic's products or websites, we welcome and greatly appreciate you reporting it to New Relic through [HackerOne](https://hackerone.com/newrelic).

## License

Automatic Grants for AUM Synced Groups is licensed under the [Apache 2.0](http://apache.org/licenses/LICENSE-2.0.txt) License.
