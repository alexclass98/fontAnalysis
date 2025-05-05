from django.db import models
from django.conf import settings


class User(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    login = models.CharField(max_length=255, unique=True)
    password = models.CharField(max_length=255)

    def __str__(self):
        return self.name


class Administrator(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    def __str__(self):
        return f"Administrator: {self.user.username}"



class Graph(models.Model):
    id = models.AutoField(primary_key=True)
    cipher_count = models.IntegerField()
    administrator = models.OneToOneField(Administrator, on_delete=models.CASCADE)

    def __str__(self):
        return f'Graph with {self.cipher_count} ciphers'


class Node(models.Model):
    name = models.CharField(max_length=255)
    graph = models.ForeignKey(Graph, related_name="nodes", on_delete=models.CASCADE)

    def __str__(self):
        return self.name


class Edge(models.Model):
    node1 = models.ForeignKey(Node, related_name="edges_from", on_delete=models.CASCADE)
    node2 = models.ForeignKey(Node, related_name="edges_to", on_delete=models.CASCADE)
    connection_type = models.CharField(max_length=255)

    def __str__(self):
        return f'{self.node1} -> {self.node2}'


class Reaction(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    description = models.TextField()

    def __str__(self):
        return self.name


class Study(models.Model):
    id = models.AutoField(primary_key=True)
    cipher = models.ForeignKey('Cipher', on_delete=models.CASCADE)
    reaction = models.ForeignKey(Reaction, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    result = models.TextField()

    def __str__(self):
        return f'Study {self.id}'


class Cipher(models.Model):
    id = models.AutoField(primary_key=True)
    result = models.TextField()

    def __str__(self):
        return f'Cipher {self.id}'


class Association(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    cipher = models.ForeignKey(Cipher, on_delete=models.CASCADE)
    reaction_description = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Association for {self.user.username} - {self.reaction_description}"