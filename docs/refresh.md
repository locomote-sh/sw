# Locomote file DB refresh

This document describes the procedure used by the Locomote service worker to refresh its local file database and cache state by synchronizing it with the remote content origin.

# Background

## Terminology

First, a description of some of the terminology used in this document:

* **client**: This refers to the service worker code running within a client browser. The client is always _local_.
* **content origin**: This refers to the Locomote server where content data is read from, and is defined using a _content origin URL_. The content origin is always _remote_ to the client, and is accessed over the network.
* **file database**: This is the list of published files within a content origin, and more specifically refers to an IndexedDB object store used to store the file list and associated meta data on the client. Generally, each record in the file db represents a file in the content repository (but see _control records_ below); and the file's path, relative to the content origin, is used as the record primary key in the object store.
* **file cache**: This is the cache of files maintained by the client, and downloaded from the content origin to the client for local access.
* **content repository**: A git repository used to store and manage the files within a single content origin.
* **fileset**: The files within a content origin are organized into _filesets_, based on a file's location and file type (i.e. file extension) within the content repository. Filesets are mutually exclusive, and a file can only belong to one fileset. A file's fileset membership is principally used to control how the file is locally cached on the client.
* **fileset category**: The name assigned to a fileset; any files belonging to the fileset are assigned the name as their _fileset category_.
* **updates feed**: This is a server-side URL endpoint (located at `/updates.api` under the content origin URL) which returns a list of file db records when queried by the client. The updates feed can be used to either return a complete list of all active records in the file db, or a list of records modified since some reference point.
* **control record**: Control records are objects inserted into the local file db in order to store meta-data about the file db state. As such, they don't represent actual files in the content repository, but are modelled as virtual files. Control records always have a file path beginning with `.locomote/`, and fileset category name beginning with `$`. Most control records are created by the server and returned to the client in the updates feed, but some are created by the client after a refresh. Control records are described in further detail in the following section.


## Control record types

Locomote maintains a small number of different control record types in order to track a file db's state. The different record types are differentiated by their fileset category name, and control categories always begin with `$`. The different control record categories are:

* `$commit`: Used to store the content repository commit history. Commit records have a path (i.e. primary key) in the form `.locomote/commit/{commit}`, where `{commit}` is the short hash of the commit. Commit records are generated by the server.
* `$latest`: Used to store the hash of the most recent commit in the file db; latest commit records always have a path of `.locomote/commit/$latest`. Latest records are generated by the server.
* `$category`: Category records are used to represent the different fileset categories of each file in the db. Each category record has a path name of `.locomote/category/{category}`, where `{category}` is the fileset category name. The category record is generated by the server and contain the hash of the most recent commit that modified a file or files within the fileset.
* `$fingerprint`: Fingerprint records are generated by the client and are used to record fileset category state before starting a refresh. After downloading the updates feed, the client uses differences between the fingerprint and category records to detect which fileset contents need to be downloaded. Fingerprint records have path names in the format `.locomote/fingerprint/{category}`, where `{category}` is a fileset category name.
* `$acm`: ACM (access control mechanism) record is used to detect when the set of files visible to the client changes. The files accessible to the client within a content origin may be restricted due to access control or configuration settings, and these can be captured as a fingerprint which is essentially a hash (calculated by the server) of all the settings which may affect a client's visibility on the content. Whilst this fingerprint remains the same, the client knows that it can remain in-sync with content state on the server just by tracking file changes as they are published through the updates feed. However, if the ACM fingerprint changes then the client must perform a complete refresh of the content (essentially, a hard-reset of its local state) before it can continue to track changes again. The ACM record has a path name of `.locomote/acm/group`. Additionally, the client will create a fingerprint record with category `$fingerprint` and path name `.locomote/fingerprint/acm/group` before starting a refresh.


## Record status

The record status is a field on file db records (with property name `"status"`) used to indicate the published status of the associated file. Generally, all files will have a status of `"published"`, indicating that the file is available and up to date; however, during refreshes some records may be marked with a status of `"deleted"`, indicating that the record and any associated file data in the local caches needs to be removed.

# Refresh procedure

The following sections describe each of the steps of the procedure used to refresh the file database.

## 1. Read latest commit

The procedure starts by reading the _latest commit_ record from the local file db. (See `$latest` control record category described above). If the latest commit record is found then it's `"commit"` property is provisionally used as the value for the `since` parameter on the updates feed request.

## 2. Check ACM fingerprint

If a latest commit record is available then the procedure next reads the ACM group fingerprint records from the file db. These are stored under the paths `.locomote/acm/group` and `.locomote/fingerprint/acm/group`. If neither record is found, or if both are found but have different values in the `commit` properties, then a full refresh is forced by discarding the value of the `since` parameter.

## 3. Staleing commits before full refresh

If there is no `since` parameter, indicating that a full refresh is needed, then all commit records are marked as stale (by adding the property `"_stale": true` to each record). This is necessary because a full refresh will return only a list of the currently active files within the content origin, meaning that potentially, if there are any files in the current local state of the file db which have since been deleted on the server, then these will remain in the local copy of the file db after the refresh. To avoid this, without completely deleting the local file db copy, all local commit records are marked as 'potentially deleted' (i.e. _stale_) before the refresh. After the refresh, all current commit records will have been overwritten, loosing their stale status. Any commit records remaining stale after the refresh can then be considered as not part of the active set, and they and any files belonging to those commits can be deleted.

## 4. Refresh request

The client sends a request to the server's `updates.api` endpoint. If the request includes a `since` parameter then the server will return only a list records representing those files which have been modified since the reference commit. Any files which have been deleted within the represented period will have a file status of `"deleted"`. If there is no `since` parameter then the server will return a complete list of all the currently active files in the content origin.

## 5. Update the ACM group fingerprint

The client reads the ACM group fingerprint record under path `.locomote/acm/group`, and rewrites it to the path `.locomote/fingerprint/acm/group` and category `$fingerprint`. (See step 2 above).

## 6. Delete stale commits and associated files

The client queries the file db for any commit records with `"_stale": true` still set. These represent commits which should no longer be in the local copy of the file db (see step 3 above). If and when the client finds a stale commit record, it then queries the file db for any records belonging to that commit, and updates their status to `"deleted"`. These will then be completely removed from the file db during the tidy-up phase (see step 8 below).

## 7. Fileset downloads

The client queries the file db for category records. Iterating over each record, it reads the associated fingerprint record under path name `.locomote/fingerprint/{category}`, and if found compares the fingerprint commit to the commit on the category record. If these are different, or if a fingerprint record wasn't found, then the client initiates a download of the fileset contents from the server, before writing a new fingerprint record to the file db.

The default fileset contents download works by first querying the server for a list of the names of the currently active files within the fileset. If a fileset category fingerprint record is available then its hash is used as a `since` parameter to the request, and the server in this case returns a list of only the names of the files within the fileset which have been modified (created or updated, but not deleted) since the reference `since` commit. Once the client receives the list of filenames, it then downloads each file from the server and writes the file contents to the local file cache.

## 8. Tidy-up

The purpose of the tidy-up phase is to remove any obsolete records from the file db, and to delete any file cache entries associated with those records.

The tidy-up phase starts first by querying the file db for a list of file records whose status is `"deleted"`. It records the path name of each record, and builds a list of fileset category names containing deleted files.

Next, it iterates over the name of each fileset category containing deleted files, opens the file cache associated with that fileset, and then, iterating over each deleted file, deletes the associated cache entry before deleting the file record. (Note that the order of operations is important here, so as to avoid orphaned file cache entries).

Finally, the client queries the file db for all commit records, and iterating over each record, counts the number of file db records belonging to each commit. If any commit has zero records then this indicates that all files that belonged to that commit have been removed from the local copy of the file db. That commit record is now no longer needed and is deleted from the file db.

