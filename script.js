/* Use this require for in the synthetic monitor */
let lodash = require('lodash')

/* Use these imports instead for local testing only */
// import got  from 'got';
// import lodash from 'lodash'


/*
*  ========== SETTINGS ===========================
*/

// US or EU New Relic Data center
const REGION = "US"                      

// A user API Key for a user with organisation admin rights (secure credential recommended)            
const API_KEY="NRAK-xxxx"  //consider using secure credential here $secure.you-sec-cred

// The ID of your authentication domain. (You can find this in graphql API, see docs ) 
const AUTH_DOMAIN_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

//AUM synced groups to detect and create grants for:  regular expression should idenitfy the groups. Use a capture group to capture the account ID and provide the index of that capture group.
//
// for example for the AUM group: "My-AUM-Group-22334455-Users"
// the regex would be: /^My-AUM-Group-(\d+)-Users$/
// which would yield the account id in the first caputer group, index 1.
//
// e.g. "My-AUM-Group-22334455-Users".match(/^My-AUM-Group-(\d+)-Users$/)

const CANDIDATE_ACCOUNT_GROUPS=[
    {regex:/^My-AUM-Group-(\d+)-Users$/, index:1}
]

// The roles to grant to accounts discovered in the groups above
//     (Your role ID's can be looked up in the graphql API, see docs)
const ACCOUNT_ROLES=[
    {displayName: "MyCustomRole", roleId:9999}
]

// Global groups to aditionally add grants to for discovered accounts, along with the role to grant.
//     (Your role ID's can be looked up in the graphql API, see docs)
const GLOBAL_CANDIDATE_GROUPS=[
    {regex: /^MyGlobalGroup$/, roleDisplayName: "MyOtherCustomRole", roleId: 8888}
]

//
const DRY_RUN = false  //set to true to disable the actual creation of grants (for testing)


// -----------------
//You should not have to edit below here


const GRAPHQL_API= REGION=="EU" ? "https://api.eu.newrelic.com/graphql" : "https://api.newrelic.com/graphql" 

/*
*  ========== LOCAL TESTING CONFIGURATION ===========================
*  This section allows you to run the script from your local machine
*  mimicking it running in the new relic environment. Much easier to develop!
*/
let RUNNING_LOCALLY=false
const IS_LOCAL_ENV = typeof $http === 'undefined';
if (IS_LOCAL_ENV) {  
  RUNNING_LOCALLY=true
  var $http=got
  var $secure = {}
  console.log("Running in local mode")
}  

/*
*  ========== HANDY UTILITY FUNCTIONS  ===========================
*/

/*
* setAttribute()
* Sets a custom attribute on the synthetic record
*
* @param {string} key               - the key name
* @param {Strin|Object} value       - the value to set
*/
const setAttribute = function(key,value) {
    if(!RUNNING_LOCALLY) { //these only make sense when running on a minion
        $util.insights.set(key,value)
    } else {
        console.log(`Set attribute '${key}' to ${value}`)
    }
}

/*
* genericServiceCall()
* Generic service call helper for commonly repeated tasks
*/
const DEFAULT_TIMEOUT=5000
const  genericServiceCall = function(options) {
    !(options.timeout)  && (options.timeout = {request: DEFAULT_TIMEOUT}) //add a timeout if not already specified 
    return $http(options)
}


/*
*  ========== SCRIPT FUNCTIONS  ===========================
*/

/*
* assignGrant()
* Performs a graphql mutation to grant access to specified group/role/accountId triplet.
*
*   groupName - Name of the group (display purposes only)
*   groupId - ID of the group
*   accountId - Account Id to 
*   roleName - Name of the role (display purposes only)
*   roleId - role ID
*/
const assignGrant = async (groupName,groupId,accountId,roleName, roleId) =>{
    if(DRY_RUN) {
        console.log(`[DRY RUN] Granting ${roleName}(${roleId}) on account ${accountId} to group ${groupName}(${groupId})  `)
        return true
    } else {
        console.log(`Granting ${roleName}(${roleId}) on account ${accountId} to group ${groupName}(${groupId})  `)
        const grantGQL=`mutation {
            authorizationManagementGrantAccess(grantAccessOptions: {groupId: "${groupId}", accountAccessGrants: {accountId: ${accountId}, roleId: ${roleId}}}) {
            roles {
                name
                roleId
                id
                displayName
                accountId
                type
            }
            }
        }`
      let response= await GQLPost(grantGQL) 
      return response
    }

}

/*
* GQLPost()
* Performs a graphql post. Automatically replaces cursor with value if supplied.
* Use pattern [[CURSOR]] to represent cursor value in graphql query.
*
*   gql - The graph QL query/mutation
*   cursor - an optional cursor value
*/
const GQLPost = async (gql,cursor) => {
    gql = gql.replaceAll("\"[[CURSOR]]\"",cursor ? cursor : "null") //if there is a [[CURSOR]] then set its value.
    const options = { 
        url: GRAPHQL_API,
        method: 'POST',
        headers :{
          "Content-Type": "application/json",
          "API-Key": API_KEY
        },
        body: JSON.stringify({query: gql})
    }
    let response = await genericServiceCall(options)
    try {
        return JSON.parse(response.body)
    } catch(e) {
        console.log("GQL Response was not json!",response.body)
        return null
    }
}


/*
* cursorGQL()
* Pages graphql call. Calls graphql repeatedly until there are no cursors remiaing. 
* Returns array containg results from all queries.
*
*   gql - The graphQL query
*   cursorPath - a path to the attribute in the response json that contains the next cursor value
*   dataPath - the path of the atrtibute that contains the repsonse data we're interested in
*/
const cursorGQL =  async (gql, cursorPath, dataPath) =>  {
    let dataChunks=[]
    let tryNextCursor=true
    let nextCursor=null
    let gqlHasCursor = gql.includes("[[CURSOR]]")
    let cursorCount=0
    console.log("Querying graphql api for data...")
    while (tryNextCursor) {
        cursorCount++
        let latestData=await GQLPost(gql,nextCursor)
        let cursor = lodash.get(latestData,cursorPath,null)
        if(gqlHasCursor && cursor !== null) {
            nextCursor=cursor
        } else {
            tryNextCursor = false
        }
        let data =  lodash.get(latestData,dataPath)

        if(data) {
            if(Array.isArray(data)) {
                dataChunks=[...dataChunks, ...data]
            } else {
                dataChunks.push(data)
            }
        } else {
            console.log(`Error: no data found for path ${dataPath} in response:`,latestData)
        }
    }
    console.log(`GQL pages loaded: ${cursorCount}`)
    return dataChunks
}


/*
*  ========== SCRIPT RUNNNER  ===========================
*/

/*
* scriptRunner()
* Main ansync flow control for script
*/

const scriptRunner = async () =>{

    // Search for all the auth groups in the given auth domain
    const groupsGQL=`{
        actor {
          organization {
            authorizationManagement {
              authenticationDomains(id: "${AUTH_DOMAIN_ID}") {
                authenticationDomains {
                  groups(cursor: null) {
                    groups {
                      displayName
                      id
                      roles {
                        roles {
                          accountId
                          displayName
                          id
                          name
                          roleId
                          type
                        }
                        totalCount
                      }
                    }
                    nextCursor
                  }
                  name
                  id
                }
              }
            }
          }
        }
      }
      `.replace("cursor: null", "cursor: \"[[CURSOR]]\"")
    let groups= await cursorGQL(groupsGQL,"data.actor.organization.authorizationManagement.authenticationDomains.authenticationDomains[0].groups.nextCursor", "data.actor.organization.authorizationManagement.authenticationDomains.authenticationDomains[0].groups.groups")

    //Filter all the groups down to only those that pass our ACCOUNT  regex filter
    let accountGroups = groups.filter((group)=>{
        let match=false
        CANDIDATE_ACCOUNT_GROUPS.forEach((candidate)=>{if(group.displayName.match(candidate.regex)){ match=true}})
        return match
    })
    //console.log("ACCOUNT GROUPS",accountGroups)

    //Filter all the groups down to only those matching the global group regex
    let globalGroups = groups.filter((group)=>{
        let match=false
        GLOBAL_CANDIDATE_GROUPS.forEach((candidate)=>{if(group.displayName.match(candidate.regex)){ match=true}})
        return match
    })
    //console.log("GLOBAL GROUPS",globalGroups)


    //Process each group in turn
    let accounts=[]
    let totalAccountAdjustments=0
    accountGroups.forEach(async (group)=>{
        let adjustmentsRequired=0
        console.log(`\n\nGroup: ${group.displayName}`)

        //Determine the account ID using the regex capture group
        let accountId
        CANDIDATE_ACCOUNT_GROUPS.forEach((candidate)=>{
            let matchResult=group.displayName.match(candidate.regex)
            if( !accountId && matchResult && matchResult[candidate.index]){
                accountId=matchResult[candidate.index]
            }
        })

        if(!accountId) {
            console.log("ERROR: No account ID detected for this group")
        } else {
            if(!accounts.includes(accountId)) {
                accounts.push(accountId)
            }
            console.log(`Account: ${accountId}`)


            //Determine account roles
            ACCOUNT_ROLES.forEach(async (candidateRole)=>{
                if(!group.roles.roles.some((role)=>{return role.roleId == candidateRole.roleId && role.accountId==accountId})) {
                    adjustmentsRequired++
                    console.log(`Grant required for account ${accountId} in account specific group ${group.displayName} for role ${candidateRole.displayName}(${candidateRole.roleId})`)
                    await assignGrant(group.displayName,group.id,accountId,candidateRole.displayName, candidateRole.roleId)
                }

            })
        }
        console.log(adjustmentsRequired>0 ? `${adjustmentsRequired} adjustments were required` : "No adjustments required")
        totalAccountAdjustments=totalAccountAdjustments+adjustmentsRequired
        
    })
    setAttribute("accountAdjustments",totalAccountAdjustments)

    //Process global group account subscriptions
    console.log("\n\nProcessing global groups...")
    let adjustmentsRequired=0
    GLOBAL_CANDIDATE_GROUPS.forEach(async (candidate)=>{
        let globalGroup=globalGroups.find((group)=>{ return group.displayName.match(candidate.regex)})
        accounts.forEach(async (account)=>{
            if(!globalGroup.roles.roles.some((role)=>{return role.accountId==account && role.roleId==candidate.roleId})) {
                adjustmentsRequired++
                console.log(`Grant required for account ${account} in global group ${globalGroup.displayName}`)
                await assignGrant(globalGroup.displayName,globalGroup.id,account,candidate.roleDisplayName, candidate.roleId)
            }
        })
    })
    console.log(adjustmentsRequired>0 ? `${adjustmentsRequired} global adjustments were required` : "No global adjustments required")
    setAttribute("globalAdjustments",adjustmentsRequired)

    return false
}


/*
*  ========== RUN AYSNC ===========================
*/
try {
    scriptRunner().then((failed)=>{
        if(failed) {
            setAttribute("runFailure","YES")
        }
        setAttribute("runComplete","YES") //to ensure we've not timed out or broken somehow
    })

} catch(e) {
    console.log("Unexpected errors: ",e)
}