"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

interface Project {
  [key: string]: any;
}

interface ConfigureDataProps {
  onSelectProject: (project: Project) => void;
}

export function ConfigureData({ onSelectProject }: ConfigureDataProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetch("/api/external-projects")
        .then((response) => {
          if (!response.ok) {
            return response.json().then((err) => {
              throw new Error(err.detail || "Failed to fetch");
            });
          }
          return response.json();
        })
        .then((data) => setProjects(data))
        .catch((error) => console.error("Error fetching projects:", error));
    }
  }, [isOpen]);

  const handleSelectProject = (project: Project) => {
    fetch(`/api/external-projects/${project.id}`)
      .then((response) => {
        if (!response.ok) {
          return response.json().then((err) => {
            throw new Error(err.detail || "Failed to fetch project details");
          });
        }
        return response.json();
      })
      .then((data) => {
        onSelectProject(data);
        setIsOpen(false);
      })
      .catch((error) =>
        console.error("Error fetching project details:", error)
      );
  };

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Configure Data</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select a Project</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Search for a project..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-4"
        />
        <ScrollArea className="h-72">
          <div className="space-y-2">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="p-2 border rounded-md cursor-pointer hover:bg-gray-100"
                onClick={() => handleSelectProject(project)}
              >
                {project.name}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
