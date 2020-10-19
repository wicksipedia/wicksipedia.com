#! /bin/bash

post_date=$(date +%Y-%m-%d)
post_title=$1
post_sanitised_title=$(echo $1 | sed -e 's/ /-/g')
post_dirpath=content/posts/$(date +%Y/%m/%d)-$post_sanitised_title

# create post dir
mkdir -p "$post_dirpath"

# replace post content
sed -e "
s/{{post_date}}/$post_date/g
s/{{post_title}}/$post_title/g
s/{{post_sanitised_title}}/$post_sanitised_title/g
" templates/post.md >> $post_dirpath/$post_sanitised_title.md